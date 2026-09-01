using System.Diagnostics;
using MathComps.Domain.Contracts.Defense;
using MathComps.Domain.EfCoreEntities;
using MathComps.Domain.Localization;
using MathComps.Infrastructure.Options;
using MathComps.Infrastructure.Persistence;
using MathComps.Infrastructure.Services.Ai;
using MathComps.Infrastructure.Services.Defense.Content;
using MathComps.Infrastructure.Services.Defense.Engine;
using MathComps.Infrastructure.Services.Localization;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Options;

namespace MathComps.Infrastructure.Services.Defense;

/// <summary>
/// Implements <see cref="IDefenseSessionService"/> over the database and the examiner engine. A turn checks its
/// inputs first, then takes the user's serialization gate, weighs the message and spend caps under it, runs the engine
/// (no DB work while it runs), and persists the turns and one <see cref="DefenseSpend"/> row from the turn's cost —
/// the gate held throughout so a user's concurrent turns can't each clear the spend check against the same
/// pre-write total.
/// </summary>
/// <param name="dbContextFactory">The factory minting each operation's database context.</param>
/// <param name="examiner">The engine that produces the examiner's reply.</param>
/// <param name="limits">The input, message, and spend caps.</param>
/// <param name="examinerConfigSnapshotProvider">The examiner engine's config snapshot, stamped onto each new
/// session.</param>
/// <param name="turnGate">Serializes a single user's turns.</param>
/// <param name="contentResolver">Looks up what a new session's examiner is told about the problem.</param>
/// <param name="defenseCopy">The examiner's own lines, in the student's language.</param>
/// <param name="targetGuard">Says whether a student may argue what the target names.</param>
/// <param name="localization">Resolves the localized names a competition problem is listed under.</param>
public class DefenseSessionService(
    IDbContextFactory<MathCompsDbContext> dbContextFactory, IExaminer examiner, IOptions<DefenseLimits> limits,
    IExaminerConfigSnapshotProvider examinerConfigSnapshotProvider, IDefenseUserTurnGate turnGate,
    IDefenseContentResolver contentResolver, IDefenseCopy defenseCopy, IDefenseTargetGuard targetGuard,
    IMetadataLocalizationService localization)
    : IDefenseSessionService
{
    /// <summary>
    /// The input, message, and spend caps.
    /// </summary>
    private readonly DefenseLimits _limits = limits.Value;

    /// <summary>
    /// The examiner's config snapshot, ready to stamp onto each new session.
    /// </summary>
    private readonly string _examinerConfigJson = examinerConfigSnapshotProvider.Json;

    /// <inheritdoc/>
    public async Task<DefenseSessionDto> StartAsync(
        Guid userId, DefenseSessionStart start, CancellationToken cancellationToken = default)
    {
        // Every field a start needs must be present and non-blank; a missing one (null through JSON) or a blank one
        // is a bad request, not a server fault.
        DefenseInputs.EnsureTargetPresent(start.Request.Target, _limits);
        DefenseInputs.EnsureNotBlank(start.Request.Content);

        // Bound the student's message before doing anything with it.
        DefenseInputs.EnsureWithinLength(start.Request.Content, _limits.MaxCandidateChars);

        // Whether this student may argue the target at all, settled before the content is so much as read: an
        // embargoed statement and its reference both ride back in the answer. Whether they hold an entry into it
        // comes back with the verdict.
        var holdsHostedEntry = await targetGuard.EnsureCanDefendAsync(
            userId, start.Request.Target, cancellationToken);

        // The problem itself comes from the site's own content, so a caller can only choose which problem to
        // defend, never what the examiner is told about it. A target naming content nothing is published for is a
        // 404 rather than a rejected input: the request was well formed, the content just isn't there.
        var problem = await contentResolver.ResolveAsync(start.Request.Target, start.Language, cancellationToken)
            ?? throw new DefenseContentNotFoundException();

        // Fold the author's hints into the reference so the examiner reads them as staged, earned-only help.
        var reference = AuthorHintsSection.BuildReference(problem.Reference, problem.Hints);

        // The examiner's own greeting, in the language the student is working in.
        var opener = defenseCopy.GetOpener(start.Language);

        // Serialize this user's turns for the rest of the operation, so concurrent starts each see the other's spend.
        using var turnLock = await turnGate.AcquireAsync(userId, cancellationToken);

        // A fresh context for this operation.
        await using var dbContext = await dbContextFactory.CreateDbContextAsync(cancellationToken);

        // Refuse the turn if the user is already over their spend ceiling, which an entry of their own puts them
        // outside. Nothing weighs the message cap here: a start writes exactly one message and the cap admits at
        // least one.
        if (!holdsHostedEntry)
            await EnsureUnderSpendCeilingAsync(dbContext, userId, cancellationToken);

        // One timestamp for the session and its seed turns.
        var seededAt = DateTimeOffset.UtcNow;

        // A fresh session holding the problem and its reference for this and later turns.
        var session = new DefenseSession
        {
            UserId = userId,
            TargetKind = DefenseTargets.KindOf(start.Request.Target),
            ProblemStatement = problem.Statement,
            ProblemReference = reference,
            ExaminerConfig = _examinerConfigJson,
            CreatedAt = seededAt,
        };

        // Seed the examiner's opener, a canned greeting rather than an LLM turn.
        AppendTurn(session, TranscriptRole.Examiner, opener, seededAt);

        // Seed the student's first message.
        AppendTurn(session, TranscriptRole.Candidate, start.Request.Content, seededAt);

        // Run the engine over the seed and stage its reply and spend row.
        await RunExaminerAndStageAsync(dbContext, session, userId, !holdsHostedEntry, cancellationToken);

        // Track the new session.
        dbContext.DefenseSessions.Add(session);

        // And the row saying what it defends, which is one row of one table either way.
        await DefenseTargets.AddRowAsync(dbContext, session.Id, start.Request.Target, cancellationToken);

        // Persist the session, its turns, its target, and the spend row in one write.
        await dbContext.SaveChangesAsync(cancellationToken);

        // Hand back the full conversation.
        return ToSessionDto(session, start.Request.Target);
    }

    /// <inheritdoc/>
    public async Task<DefenseSessionDto> ContinueAsync(
        Guid userId, Guid sessionId, string content, CancellationToken cancellationToken = default)
    {
        // Reject a blank message before anything else; there's nothing to defend.
        DefenseInputs.EnsureNotBlank(content);

        // Bound the message before doing anything with it.
        DefenseInputs.EnsureWithinLength(content, _limits.MaxCandidateChars);

        // Serialize this user's turns for the rest of the operation, so concurrent continues can't both clear the
        // message cap and spend check against the same pre-write state.
        using var turnLock = await turnGate.AcquireAsync(userId, cancellationToken);

        // A fresh context for this operation.
        await using var dbContext = await dbContextFactory.CreateDbContextAsync(cancellationToken);

        // The set the projection below reads. Held as its own value so the expression tree captures a set rather
        // than the context around it, which the analyzer reads as disposed by the time the tree runs.
        var allEntries = dbContext.HostedEntries;

        // The session with its turns (tracked, for the append below), the student's answer for it and what they
        // hold against its replies, the columns of both target arms, of which the session's kind says which are
        // filled, and whether they hold an entry into the round its problem sits in. Split, because turns and
        // reports are two collections off one row: joined in a single query the database would return every
        // pairing of them, each repeating the session's statement, reference, and settings snapshot. Another
        // user's session never comes back from it, and a missing one reads the same.
        var loaded = await dbContext.DefenseSessions
            .Include(defenseSession => defenseSession.Turns)
            .Include(defenseSession => defenseSession.Feedback)
            .Include(defenseSession => defenseSession.Reports)
            .AsSplitQuery()
            .Where(DefenseSessionWrites.IsOwnedBy(userId, sessionId))
            .Select(defenseSession => new
            {
                Session = defenseSession,
                HandoutContentId = (string?)defenseSession.EnvironmentTarget!.HandoutEnvironment.Handout.ContentId,
                EnvironmentId = (string?)defenseSession.EnvironmentTarget.HandoutEnvironment.ContentId,
                ProblemId = (Guid?)defenseSession.ProblemTarget!.ProblemId,
                HoldsHostedEntry = allEntries.Any(entry =>
                    entry.UserId == userId
                    && entry.RoundId == defenseSession.ProblemTarget!.Problem.RoundId),
            })
            .FirstOrDefaultAsync(cancellationToken)
            ?? throw new DefenseSessionNotFoundException();

        // The tracked session the rest of this method appends to and saves.
        var session = loaded.Session;

        // Count the student's messages so far.
        var studentMessages = session.Turns.Count(turn => turn.Role == TranscriptRole.Candidate);

        // Refuse once the conversation has grown to its message cap.
        if (studentMessages >= _limits.MaxMessagesPerDefense)
            throw new DefenseMessageLimitException();

        // Refuse the turn if the user is already over their spend ceiling, which an entry of their own puts them
        // outside.
        if (!loaded.HoldsHostedEntry)
            await EnsureUnderSpendCeilingAsync(dbContext, userId, cancellationToken);

        // Append the student's message.
        AppendTurn(session, TranscriptRole.Candidate, content, DateTimeOffset.UtcNow);

        // Run the engine over the whole conversation and stage its reply and spend row.
        await RunExaminerAndStageAsync(
            dbContext, session, userId, !loaded.HoldsHostedEntry, cancellationToken);

        // Persist the appended turns and the spend row in one write.
        await dbContext.SaveChangesAsync(cancellationToken);

        // Hand back the grown conversation.
        return ToSessionDto(
            session,
            DefenseTargets.FromColumns(
                session.TargetKind, loaded.HandoutContentId, loaded.EnvironmentId, loaded.ProblemId));
    }

    /// <inheritdoc/>
    public async Task<DefenseSessionListDto> ListAsync(
        Guid userId, DefenseTarget target, CancellationToken cancellationToken = default)
    {
        // A fresh context for this operation.
        await using var dbContext = await dbContextFactory.CreateDbContextAsync(cancellationToken);

        // The user's sessions against this target, most recently active first: each conversation in order,
        // the student's answer for it, and what they hold against its replies. Every session in this list defends
        // the target the caller named, so it rides into each one. Split, so the turns and the reports don't
        // multiply out.
        var sessions = await dbContext.DefenseSessions
            .AsNoTracking()
            .AsSplitQuery()
            .Where(session => session.UserId == userId)
            .Where(DefenseTargets.HeldAgainst(target))
            .OrderByDescending(session => session.Turns.Max(turn => turn.CreatedAt))
            // A tie goes to the session started later: ids are time-ordered v7 Guids.
            .ThenByDescending(session => session.Id)
            .Select(session => new DefenseSessionDto(
                session.Id,
                target,
                session.Turns
                    .OrderBy(turn => turn.Sequence)
                    .Select(turn => new DefenseTurnDto(turn.Id, turn.Role, turn.Content, turn.CreatedAt))
                    .ToList(),
                session.Feedback == null
                    ? null
                    : new DefenseFeedbackDto(session.Feedback.Outcome, session.Feedback.Comment),
                session.Reports
                    .Select(report => new DefenseTurnReportDto(
                        report.TurnId, report.Categories, report.Comment))
                    .ToList()))
            .ToListAsync(cancellationToken);

        // Hand them back with the caps a further turn is held to.
        return new DefenseSessionListDto(
            sessions,
            new DefenseLimitsDto(
                _limits.MaxCandidateChars, _limits.MaxFeedbackCommentChars, _limits.MaxMessagesPerDefense));
    }

    /// <inheritdoc/>
    public async Task<IReadOnlyList<DefenseSessionListItemDto>> ListAllAsync(
        Guid userId, Language language, CancellationToken cancellationToken = default)
    {
        // A fresh context for this operation.
        await using var dbContext = await dbContextFactory.CreateDbContextAsync(cancellationToken);

        // The user's sessions, most recently active first, each with the columns of both target arms, the round
        // it was argued under, its statement, last activity, and the student's most recent message.
        var rows = await dbContext.DefenseSessions
            .AsNoTracking()
            .Where(session => session.UserId == userId)
            // A session whose handout environment was dropped keeps its own row, and there is nothing left to
            // name it by, so it is left out rather than failing the whole list.
            .Where(session => session.EnvironmentTarget != null || session.ProblemTarget != null)
            .OrderByDescending(session => session.Turns.Max(turn => turn.CreatedAt))
            // A tie goes to the session started later: ids are time-ordered v7 Guids.
            .ThenByDescending(session => session.Id)
            .Select(session => new ListRow(
                session.Id,
                new NamedDefenseTargets.Columns(
                    session.EnvironmentTarget!.HandoutEnvironment.Handout.ContentId,
                    session.EnvironmentTarget!.HandoutEnvironment.ContentId,
                    session.ProblemTarget!.ProblemId,
                    session.ProblemTarget!.Problem.RoundId,
                    session.ProblemTarget!.Problem.Slug,
                    session.ProblemTarget!.Problem.Number,
                    session.ProblemTarget!.Problem.Round.Competition.Path,
                    session.ProblemTarget!.Problem.Round.Season.EditionNumber,
                    session.ProblemTarget!.Problem.Round.Season.StartYear),
                new DefenseGrading(
                    session.ProblemTarget == null
                        ? null
                        : new DefenseProblemRound(
                            session.ProblemTarget.Problem.Round.HostedGroupId != null,
                            session.ProblemTarget.Problem.Round.HostedGroup!.ClosesAt)),
                session.ProblemStatement,
                session.Turns.Max(turn => turn.CreatedAt),
                session.Turns
                    .Where(turn => turn.Role == TranscriptRole.Candidate)
                    .OrderByDescending(turn => turn.Sequence)
                    .Select(turn => turn.Content)
                    .FirstOrDefault()))
            .ToListAsync(cancellationToken);

        // Name each one.
        return
        [
            .. rows.Select(row => new DefenseSessionListItemDto(
                row.Id,
                NamedDefenseTargets.Build(localization, language, row.Target),
                row.Statement,
                row.LastActivityAt,
                row.LastStudentMessage,
                row.Grading.IsGraded)),
        ];
    }

    /// <inheritdoc/>
    public async Task DeleteAsync(Guid userId, Guid sessionId, CancellationToken cancellationToken = default)
    {
        // Serialize against this user's turns: an in-flight continue builds its turn in memory and saves at the
        // very end, so without the gate a delete could remove the session first and turn that save into a
        // foreign-key failure.
        using var turnLock = await turnGate.AcquireAsync(userId, cancellationToken);

        // A fresh context for this operation.
        await using var dbContext = await dbContextFactory.CreateDbContextAsync(cancellationToken);

        // What the student argued where they are graded is not theirs to drop.
        await EnsureNotGradedAsync(dbContext, userId, sessionId, cancellationToken);

        // Delete the session, filtering on the owner so another user's id can't reach it. The cascade drops its
        // turns and everything the student said about the conversation; the spend rows are independent and stay.
        var deleted = await dbContext.DefenseSessions
            .Where(DefenseSessionWrites.IsOwnedBy(userId, sessionId))
            .ExecuteDeleteAsync(cancellationToken);

        // Nothing deleted means the session is missing or someone else's, which read the same from here.
        if (deleted == 0)
            throw new DefenseSessionNotFoundException();
    }

    /// <inheritdoc/>
    public async Task RewindAsync(
        Guid userId, Guid sessionId, int keepThroughSequence, CancellationToken cancellationToken = default)
    {
        // Truncate the conversation, once it is settled that it is the caller's. The gate matters doubly here:
        // a continue builds its turn in memory and saves at the very end, so without it this delete could
        // interleave and leave the sequence non-contiguous.
        await DefenseSessionWrites.ToOwnedSessionAsync(
            dbContextFactory, turnGate, userId, sessionId, async dbContext =>
            {
                // A rewind of a graded conversation would quietly rewrite what the student argued under their
                // entry.
                await EnsureNotGradedAsync(dbContext, userId, sessionId, cancellationToken);

                // Who authored the turn to keep as the new last one.
                var keptRole =
                    await GetTurnRoleAsync(dbContext, sessionId, keepThroughSequence, cancellationToken);

                // The cut point must land on an existing examiner turn, so the rewound conversation awaits
                // the student.
                if (keptRole != TranscriptRole.Examiner)
                    throw new DefenseRewindTargetException();

                // Delete the tail in one statement: the doomed rows are never loaded, and the kept prefix stays
                // a contiguous 0..keepThroughSequence, so a later append can't collide with the
                // (session, sequence) index. Whatever the student held against the dropped replies goes with
                // them, by cascade.
                await dbContext.DefenseTurns
                    .Where(turn => turn.SessionId == sessionId && turn.Sequence > keepThroughSequence)
                    .ExecuteDeleteAsync(cancellationToken);
            }, cancellationToken);
    }

    /// <summary>
    /// Throws when what the user has spent today against their daily ceiling has reached it.
    /// </summary>
    /// <param name="dbContext">The operation's database context to query.</param>
    /// <param name="userId">The user to check.</param>
    /// <param name="cancellationToken">A token to cancel the query.</param>
    private async Task EnsureUnderSpendCeilingAsync(
        MathCompsDbContext dbContext, Guid userId, CancellationToken cancellationToken)
    {
        // The start of today, in UTC.
        var dayStart = new DateTimeOffset(DateTime.UtcNow.Date, TimeSpan.Zero);

        // Sum the user's spend since then, leaving out a defense they hold an entry into, which is exempt.
        var spent = await dbContext.DefenseSpends
            .Where(spend =>
                spend.UserId == userId && spend.CountsAgainstCeiling && spend.CreatedAt >= dayStart)
            .SumAsync(spend => spend.Cost, cancellationToken);

        // Over the ceiling refuses the turn before any model call.
        if (spent >= _limits.DailySpendCeilingPerUser)
            throw new DefenseSpendLimitException();
    }

    /// <summary>
    /// Throws when the student is graded on the round the session was argued under, which may then be neither
    /// rewound nor deleted (<see cref="DefenseGradedSessionImmutableException"/>).
    /// </summary>
    /// <param name="dbContext">The operation's database context.</param>
    /// <param name="userId">The caller, so another user's session reads as missing rather than as refused.</param>
    /// <param name="sessionId">The session being acted on.</param>
    /// <param name="cancellationToken">A token to cancel the work.</param>
    private static async Task EnsureNotGradedAsync(
        MathCompsDbContext dbContext, Guid userId, Guid sessionId, CancellationToken cancellationToken)
    {
        // What the caller's session was argued under, down to the closing instant of the group its round runs
        // in. A session that isn't theirs matches nothing and falls through to whatever the caller was doing,
        // which answers not-found on its own.
        var grading = await dbContext.DefenseSessions
            .Where(DefenseSessionWrites.IsOwnedBy(userId, sessionId))
            .Select(session => new DefenseGrading(
                session.ProblemTarget == null
                    ? null
                    : new DefenseProblemRound(
                        session.ProblemTarget.Problem.Round.HostedGroupId != null,
                        session.ProblemTarget.Problem.Round.HostedGroup!.ClosesAt)))
            .FirstOrDefaultAsync(cancellationToken);

        // Refused whenever the student is graded on the round it was argued under, whatever state that entry is
        // in.
        if (grading?.IsGraded == true)
            throw new DefenseGradedSessionImmutableException();
    }

    /// <summary>
    /// Reads who authored the turn at one sequence of a session.
    /// </summary>
    /// <param name="dbContext">The operation's database context.</param>
    /// <param name="sessionId">The session the turn belongs to.</param>
    /// <param name="sequence">The turn's position in the conversation.</param>
    /// <param name="cancellationToken">A token to cancel the work.</param>
    /// <returns>The turn's role, or null when the session holds no turn at that sequence.</returns>
    private static async Task<TranscriptRole?> GetTurnRoleAsync(
        MathCompsDbContext dbContext, Guid sessionId, int sequence, CancellationToken cancellationToken)
    {
        // The role of the turn at that point in the conversation, absent when nothing sits there.
        return await dbContext.DefenseTurns
            .Where(turn => turn.SessionId == sessionId && turn.Sequence == sequence)
            .Select(turn => (TranscriptRole?)turn.Role)
            .FirstOrDefaultAsync(cancellationToken);
    }

    /// <summary>
    /// Runs the examiner over the session's current turns (which must end on a student turn), then stages its reply
    /// and the turn's spend row on the context. The caller's save writes them; this method does no database
    /// round-trip itself on the success path, so a slow turn doesn't hold a connection. If the client cancels the
    /// turn partway, it records what its model calls already cost to its own row, so an abort still lands on the
    /// day's ledger. Other failures propagate unrecorded: they're our fault, not the user's, and the
    /// process-wide spend tracker still sees their cost.
    /// </summary>
    /// <param name="dbContext">The operation's database context the spend row is staged on.</param>
    /// <param name="session">The session whose conversation to reply to.</param>
    /// <param name="userId">The user the spend is recorded against.</param>
    /// <param name="countsAgainstCeiling">
    /// <inheritdoc cref="DefenseSpend.CountsAgainstCeiling" path="/summary"/></param>
    /// <param name="cancellationToken">A token to cancel the work.</param>
    private async Task RunExaminerAndStageAsync(
        MathCompsDbContext dbContext, DefenseSession session, Guid userId, bool countsAgainstCeiling,
        CancellationToken cancellationToken)
    {
        // Build the engine's transcript from the stored turns.
        var transcript = BuildTranscript(session.Turns);

        // Time the engine run, the turn's dominant latency.
        var stopwatch = Stopwatch.StartNew();

        // The turn's running spend, folded per model call so its partial total survives a cancel before the
        // examiner returns.
        var usage = new ModelUsageAccumulator();

        // Produce and stage the reply; a client abort mid-turn is caught below.
        try
        {
            // Run the loop to produce the examiner's reply.
            var outcome = await examiner.NextReplyAsync(
                session.ProblemStatement, session.ProblemReference, transcript, usage, cancellationToken);

            // Stop the clock before the follow-up bookkeeping.
            stopwatch.Stop();

            // One timestamp for the reply turn and its spend row.
            var repliedAt = DateTimeOffset.UtcNow;

            // Append the examiner's reply as the next turn.
            var turn = AppendTurn(session, TranscriptRole.Examiner, outcome.Shipped.Reply, repliedAt);

            // Hang every draft it went through off that turn, so what the guards rejected is readable beside what
            // shipped. The caller's save writes them along with the turn.
            turn.Attempts = BuildAttempts(session.Id, turn.Id, outcome, repliedAt);

            // Record what the turn spent and how long it ran, independent of the session so it survives a delete.
            dbContext.DefenseSpends.Add(new DefenseSpend
            {
                UserId = userId,
                Cost = outcome.Usage.Cost,
                PromptTokens = outcome.Usage.PromptTokens,
                CompletionTokens = outcome.Usage.CompletionTokens,
                ReasoningTokens = outcome.Usage.ReasoningTokens,
                CachedPromptTokens = outcome.Usage.CachedPromptTokens,
                DurationMs = (int)stopwatch.ElapsedMilliseconds,
                Revisions = outcome.Revisions,
                CountsAgainstCeiling = countsAgainstCeiling,
                CreatedAt = repliedAt,
            });
        }
        // Only our own token firing is a client abort. An upstream HTTP/LLM timeout also throws
        // OperationCanceledException (as TaskCanceledException, off an internal token), but that's our fault, not the
        // user's, so it falls through this catch and propagates unrecorded.
        catch (OperationCanceledException) when (cancellationToken.IsCancellationRequested)
        {
            // The client aborted the turn, but its completed calls already cost us.
            var accrued = usage.Accrued;

            // A turn cancelled before any call ran accrued nothing, so there's nothing to write.
            if (accrued != ModelUsage.Zero)
                await WriteCancelledTurnSpendAsync(
                    userId, accrued, (int)stopwatch.ElapsedMilliseconds, countsAgainstCeiling);

            // Re-throw so the endpoint maps the cancellation unchanged.
            throw;
        }
    }

    /// <summary>
    /// Records a <see cref="DefenseSpend"/> for a turn the client cancelled, logging the cost its model calls already
    /// ran up so the day's ledger holds it. Writes on a fresh context with an uncancellable token, since
    /// the request's own context and token are already torn down by the abort.
    /// </summary>
    /// <param name="userId">The user the spend is recorded against.</param>
    /// <param name="accrued">What the turn's completed model calls cost before it was cancelled.</param>
    /// <param name="durationMs">How long the turn ran before it was cancelled, in milliseconds.</param>
    /// <param name="countsAgainstCeiling">
    /// <inheritdoc cref="DefenseSpend.CountsAgainstCeiling" path="/summary"/></param>
    private async Task WriteCancelledTurnSpendAsync(
        Guid userId, ModelUsage accrued, int durationMs, bool countsAgainstCeiling)
    {
        // A fresh context so only the spend row lands, not the cancelled operation's half-built conversation.
        await using var dbContext = await dbContextFactory.CreateDbContextAsync(CancellationToken.None);

        // The spend fact for the cancelled turn; the examiner's revision count is lost once it threw, so record none.
        dbContext.DefenseSpends.Add(new DefenseSpend
        {
            UserId = userId,
            Cost = accrued.Cost,
            PromptTokens = accrued.PromptTokens,
            CompletionTokens = accrued.CompletionTokens,
            ReasoningTokens = accrued.ReasoningTokens,
            CachedPromptTokens = accrued.CachedPromptTokens,
            DurationMs = durationMs,
            Revisions = 0,
            CountsAgainstCeiling = countsAgainstCeiling,
            CreatedAt = DateTimeOffset.UtcNow,
        });

        // Commit with an uncancellable token, since the request's token is already cancelled on the abort path.
        await dbContext.SaveChangesAsync(CancellationToken.None);
    }

    /// <summary>
    /// Appends a turn to a session at the next sequence position.
    /// </summary>
    /// <param name="session">The session to append to.</param>
    /// <param name="role">Who authored the turn.</param>
    /// <param name="content">The turn's text.</param>
    /// <param name="createdAt">When the turn was recorded.</param>
    /// <returns>The appended turn, whose key is assigned client-side and so is usable before the save.</returns>
    private static DefenseTurn AppendTurn(
        DefenseSession session, TranscriptRole role, string content, DateTimeOffset createdAt)
    {
        // The turn at the next position in the conversation.
        var turn = new DefenseTurn
        {
            SessionId = session.Id,
            Role = role,
            Content = content,
            Sequence = session.Turns.Count,
            CreatedAt = createdAt,
        };

        // Hold it on the session so the caller's save writes it.
        session.Turns.Add(turn);

        // Hand it back for anything that hangs off it.
        return turn;
    }

    /// <summary>
    /// Builds the engine's transcript from a session's stored turns, in sequence order.
    /// </summary>
    /// <param name="turns">The session's turns.</param>
    /// <returns>The conversation as the engine reads it.</returns>
    private static Transcript BuildTranscript(IEnumerable<DefenseTurn> turns) =>
        new([.. turns.OrderBy(turn => turn.Sequence).Select(turn => new TranscriptTurn(turn.Role, turn.Content))]);

    /// <summary>
    /// Maps a turn's engine attempts onto rows against the turn they were drafted for. The fallback flag belongs to
    /// the turn rather than to an attempt, so it lands on the last one, which is the attempt it describes.
    /// </summary>
    /// <param name="sessionId">The session the attempts were drafted in.</param>
    /// <param name="turnId">The turn they were drafted for.</param>
    /// <param name="outcome">The turn's outcome, carrying its attempts in order.</param>
    /// <param name="createdAt">When the turn was recorded.</param>
    /// <returns>The attempt rows, in the order they were drafted.</returns>
    private static List<DefenseTurnAttempt> BuildAttempts(
        Guid sessionId, Guid turnId, ExaminerTurnOutcome outcome, DateTimeOffset createdAt) =>
    [
        .. outcome.Attempts.Select((attempt, index) => BuildAttempt(
            sessionId, turnId, index, attempt,
            isSafeFallback: outcome.SafeFallback && index == outcome.Attempts.Count - 1,
            createdAt)),
    ];

    /// <summary>
    /// Maps one engine attempt onto its row and the rows for the calls it made.
    /// </summary>
    /// <param name="sessionId">The session the attempt was drafted in.</param>
    /// <param name="turnId">The turn it was drafted for.</param>
    /// <param name="index">Its place in the turn's run.</param>
    /// <param name="attempt">The attempt itself.</param>
    /// <param name="isSafeFallback">Whether this attempt is the turn's constrained fallback.</param>
    /// <param name="createdAt">When the turn was recorded.</param>
    /// <returns>The attempt row, carrying its calls.</returns>
    private static DefenseTurnAttempt BuildAttempt(
        Guid sessionId, Guid turnId, int index, ExaminerAttempt attempt, bool isSafeFallback,
        DateTimeOffset createdAt)
    {
        // The draft and every verdict passed on it.
        var row = new DefenseTurnAttempt
        {
            SessionId = sessionId,
            TurnId = turnId,
            AttemptIndex = index,
            Reply = attempt.Reply,
            RevisionNote = attempt.RevisionNote,
            MathHolds = attempt.MathCheck.Holds,
            MathCorrection = attempt.MathCheck.Correction,
            Leaks = attempt.LeakCheck.Leaks,
            WhatLeaked = attempt.LeakCheck.WhatLeaked,
            WithholdsClose = attempt.LeakCheck.WithholdsClose,
            Established = attempt.LeakCheck.Established,
            SwitchesLanguage = attempt.LanguageCheck.SwitchesLanguage,
            CandidateLanguage = attempt.LanguageCheck.CandidateLanguage,
            IsSafeFallback = isSafeFallback,
            CreatedAt = createdAt,
            DurationMs = attempt.DurationMs,
        };

        // The calls it made, keyed off the row's client-side id.
        row.Calls =
        [
            .. attempt.Calls.Select(call => new DefenseAttemptCall
            {
                AttemptId = row.Id,
                Step = call.Step,
                Model = call.Model,
                ReasoningEffort = call.ReasoningEffort,
                Cost = call.Usage.Cost,
                PromptTokens = call.Usage.PromptTokens,
                CompletionTokens = call.Usage.CompletionTokens,
                ReasoningTokens = call.Usage.ReasoningTokens,
                CachedPromptTokens = call.Usage.CachedPromptTokens,
                DurationMs = call.DurationMs,
            }),
        ];

        // Hand back the row with its calls attached.
        return row;
    }

    /// <summary>
    /// Projects a session to its client shape: its turns in order, what the student said about the conversation,
    /// and what they hold against its replies.
    /// </summary>
    /// <param name="session">The session to project.</param>
    /// <param name="target">What the session defends.</param>
    /// <returns>The session's client shape.</returns>
    private static DefenseSessionDto ToSessionDto(DefenseSession session, DefenseTarget target) =>
        new(session.Id,
            target,
            ToTurnDtos(session.Turns),
            ToFeedbackDto(session.Feedback),
            ToReportDtos(session.Reports));

    /// <summary>
    /// Projects a session's feedback to its client shape.
    /// </summary>
    /// <param name="feedback">The student's answer, null until they give one.</param>
    /// <returns>The answer's client shape, or null when there is none.</returns>
    private static DefenseFeedbackDto? ToFeedbackDto(DefenseSessionFeedback? feedback) =>
        feedback is null
            ? null
            : new DefenseFeedbackDto(feedback.Outcome, feedback.Comment);

    /// <summary>
    /// Projects a session's turns to their client shape, in sequence order.
    /// </summary>
    /// <param name="turns">The turns to project.</param>
    /// <returns>The turns' client shapes.</returns>
    private static IReadOnlyList<DefenseTurnDto> ToTurnDtos(IEnumerable<DefenseTurn> turns) =>
        [.. turns
            .OrderBy(turn => turn.Sequence)
            .Select(turn => new DefenseTurnDto(turn.Id, turn.Role, turn.Content, turn.CreatedAt))];

    /// <summary>
    /// Projects a session's reports to their client shape.
    /// </summary>
    /// <param name="reports">The reports to project.</param>
    /// <returns>The reports' client shapes.</returns>
    private static IReadOnlyList<DefenseTurnReportDto> ToReportDtos(IEnumerable<DefenseTurnReport> reports) =>
        [.. reports.Select(report => new DefenseTurnReportDto(
            report.TurnId, report.Categories, report.Comment))];

    /// <summary>
    /// One listed conversation as it comes back, its problem still as the columns naming it.
    /// </summary>
    /// <param name="Id"><inheritdoc cref="DefenseSessionListItemDto" path="/param[@name='Id']"/></param>
    /// <param name="Target"><inheritdoc cref="NamedDefenseTargets.Columns" path="/summary"/></param>
    /// <param name="Grading"><inheritdoc cref="DefenseGrading" path="/summary"/></param>
    /// <param name="Statement"><inheritdoc cref="DefenseSessionListItemDto" path="/param[@name='Statement']"/></param>
    /// <param name="LastActivityAt">
    /// <inheritdoc cref="DefenseSessionListItemDto" path="/param[@name='LastActivityAt']"/></param>
    /// <param name="LastStudentMessage">
    /// <inheritdoc cref="DefenseSessionListItemDto" path="/param[@name='LastStudentMessage']"/></param>
    private sealed record ListRow(
        Guid Id,
        NamedDefenseTargets.Columns Target,
        DefenseGrading Grading,
        string Statement,
        DateTimeOffset LastActivityAt,
        string? LastStudentMessage);
}
