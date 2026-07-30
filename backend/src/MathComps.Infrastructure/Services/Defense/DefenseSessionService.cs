using System.Diagnostics;
using MathComps.Domain.Contracts.Defense;
using MathComps.Domain.EfCoreEntities;
using MathComps.Infrastructure.Options;
using MathComps.Infrastructure.Persistence;
using MathComps.Infrastructure.Services.Ai;
using MathComps.Infrastructure.Services.Defense.Engine;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Options;

namespace MathComps.Infrastructure.Services.Defense;

/// <summary>
/// Implements <see cref="IDefenseSessionService"/> over the database and the examiner engine. A turn takes the user's
/// serialization gate, runs the guardrails, then the engine (no DB work while it runs), then persists the turns and one
/// <see cref="DefenseSpend"/> row from the turn's cost — the gate held throughout so a user's concurrent turns can't
/// each clear the spend check against the same pre-write total.
/// </summary>
/// <param name="dbContextFactory">The factory minting each operation's database context.</param>
/// <param name="examiner">The engine that produces the examiner's reply.</param>
/// <param name="limits">The input, turn, and spend caps.</param>
/// <param name="examinerConfigSnapshotProvider">The examiner engine's config snapshot, stamped onto each new
/// session.</param>
/// <param name="turnGate">Serializes a single user's turns.</param>
public class DefenseSessionService(
    IDbContextFactory<MathCompsDbContext> dbContextFactory, IExaminer examiner, IOptions<DefenseLimits> limits,
    IExaminerConfigSnapshotProvider examinerConfigSnapshotProvider, IDefenseUserTurnGate turnGate)
    : IDefenseSessionService
{
    /// <summary>
    /// The input, turn, and spend caps.
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
        EnsureTargetPresent(start.Target);
        EnsureNotBlank(start.Statement);
        EnsureNotBlank(start.Reference);
        EnsureNotBlank(start.Opener);
        EnsureNotBlank(start.Content);

        // Fold the author's hints into the reference so the examiner reads them as staged, earned-only help.
        var reference = AuthorHintsSection.BuildReference(start.Reference, start.Hints);

        // Bound each input before doing anything with it; the reference is bounded with its hints folded in.
        EnsureWithinLength(start.Target.HandoutContentId, _limits.MaxHandoutContentIdChars);
        EnsureWithinLength(start.Target.EnvironmentId, _limits.MaxEnvironmentIdChars);
        EnsureWithinLength(start.Statement, _limits.MaxStatementChars);
        EnsureWithinLength(reference, _limits.MaxReferenceChars);
        EnsureWithinLength(start.Opener, _limits.MaxOpenerChars);
        EnsureWithinLength(start.Content, _limits.MaxCandidateChars);

        // Serialize this user's turns for the rest of the operation, so concurrent starts each see the other's spend.
        using var turnLock = await turnGate.AcquireAsync(userId, cancellationToken);

        // A fresh context for this operation.
        await using var dbContext = await dbContextFactory.CreateDbContextAsync(cancellationToken);

        // Refuse the turn if the user is already over their spend ceiling.
        await EnsureUnderSpendCeilingAsync(dbContext, userId, cancellationToken);

        // The anchor row for the environment being defended, upserted on demand.
        var handoutEnvironmentId = await UpsertHandoutEnvironmentAsync(dbContext, start.Target, cancellationToken);

        // One timestamp for the session and its seed turns.
        var seededAt = DateTimeOffset.UtcNow;

        // A fresh session holding the problem and its reference for this and later turns.
        var session = new DefenseSession
        {
            UserId = userId,
            ProblemStatement = start.Statement,
            ProblemReference = reference,
            ExaminerConfig = _examinerConfigJson,
            CreatedAt = seededAt,
        };

        // Seed the examiner's opener, a canned greeting rather than an LLM turn.
        AppendTurn(session, TranscriptRole.Examiner, start.Opener, seededAt);

        // Seed the student's first message.
        AppendTurn(session, TranscriptRole.Candidate, start.Content, seededAt);

        // Run the engine over the seed and stage its reply and spend row.
        await RunExaminerAndStageAsync(dbContext, session, userId, cancellationToken);

        // Track the new session.
        dbContext.DefenseSessions.Add(session);

        // And the environment it defends.
        dbContext.HandoutEnvironmentDefenses.Add(new HandoutEnvironmentDefense
        {
            DefenseSessionId = session.Id,
            HandoutEnvironmentId = handoutEnvironmentId,
        });

        // Persist the session, its turns, its target, and the spend row in one write.
        await dbContext.SaveChangesAsync(cancellationToken);

        // Hand back the full conversation.
        return ToSessionDto(session, start.Target);
    }

    /// <inheritdoc/>
    public async Task<DefenseSessionDto> ContinueAsync(
        Guid userId, Guid sessionId, string content, CancellationToken cancellationToken = default)
    {
        // Reject a blank message before anything else; there's nothing to defend.
        EnsureNotBlank(content);

        // Bound the message before doing anything with it.
        EnsureWithinLength(content, _limits.MaxCandidateChars);

        // Serialize this user's turns for the rest of the operation, so concurrent continues can't both clear the
        // turn cap and spend check against the same pre-write state.
        using var turnLock = await turnGate.AcquireAsync(userId, cancellationToken);

        // A fresh context for this operation.
        await using var dbContext = await dbContextFactory.CreateDbContextAsync(cancellationToken);

        // The session with its turns (tracked, for the append below), the student's answer for it and what they
        // hold against its replies, plus the two content ids of the environment it defends. The feedback rides
        // along so a grown conversation still reports what the student already said about it. Split, because
        // turns and reports are two collections off one row: joined in a single query the database would return
        // every pairing of them, each repeating the session's statement, reference, and settings snapshot.
        // Another user's session never comes back from it, and a missing one reads the same.
        var loaded = await dbContext.DefenseSessions
            .Include(defenseSession => defenseSession.Turns)
            .Include(defenseSession => defenseSession.Feedback)
            .Include(defenseSession => defenseSession.Reports)
            .AsSplitQuery()
            .Where(DefenseSessionWrites.IsOwnedBy(userId, sessionId))
            .Select(defenseSession => new
            {
                Session = defenseSession,
                Target = new HandoutEnvironmentTarget(
                    defenseSession.EnvironmentTarget!.HandoutEnvironment.Handout.ContentId,
                    defenseSession.EnvironmentTarget.HandoutEnvironment.ContentId),
            })
            .FirstOrDefaultAsync(cancellationToken)
            ?? throw new DefenseSessionNotFoundException();

        // The tracked session the rest of this method appends to and saves.
        var session = loaded.Session;

        // Count the student's turns so far.
        var studentTurns = session.Turns.Count(turn => turn.Role == TranscriptRole.Candidate);

        // Refuse once the conversation has grown to its student-turn cap.
        if (studentTurns >= _limits.MaxTurnsPerSession)
            throw new DefenseTurnLimitException();

        // Refuse the turn if the user is already over their spend ceiling.
        await EnsureUnderSpendCeilingAsync(dbContext, userId, cancellationToken);

        // Append the student's message.
        AppendTurn(session, TranscriptRole.Candidate, content, DateTimeOffset.UtcNow);

        // Run the engine over the whole conversation and stage its reply and spend row.
        await RunExaminerAndStageAsync(dbContext, session, userId, cancellationToken);

        // Persist the appended turns and the spend row in one write.
        await dbContext.SaveChangesAsync(cancellationToken);

        // Hand back the grown conversation.
        return ToSessionDto(session, loaded.Target);
    }

    /// <inheritdoc/>
    public async Task<IReadOnlyList<DefenseSessionDto>> ListAsync(
        Guid userId, HandoutEnvironmentTarget target, CancellationToken cancellationToken = default)
    {
        // A fresh context for this operation.
        await using var dbContext = await dbContextFactory.CreateDbContextAsync(cancellationToken);

        // The user's sessions against this environment, oldest first: each conversation in order, the student's
        // answer for it, and what they hold against its replies. Every session in this list defends the target
        // the caller named, so it rides into each one. Split, because turns and reports are two collections off
        // one row: joined in a single query the database would return every pairing of them.
        return await dbContext.DefenseSessions
            .AsNoTracking()
            .AsSplitQuery()
            .Where(session => session.UserId == userId
                && session.EnvironmentTarget != null
                && session.EnvironmentTarget.HandoutEnvironment.ContentId == target.EnvironmentId
                && session.EnvironmentTarget.HandoutEnvironment.Handout.ContentId == target.HandoutContentId)
            .OrderBy(session => session.CreatedAt)
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
    }

    /// <inheritdoc/>
    public async Task<IReadOnlyList<DefenseSessionListItemDto>> ListAllAsync(
        Guid userId, CancellationToken cancellationToken = default)
    {
        // A fresh context for this operation.
        await using var dbContext = await dbContextFactory.CreateDbContextAsync(cancellationToken);

        // The user's sessions across every problem, newest first, each with its target, statement, start time,
        // and the message the student opened with. A session with no linked environment is excluded.
        return await dbContext.DefenseSessions
            .AsNoTracking()
            .Where(session => session.UserId == userId && session.EnvironmentTarget != null)
            .OrderByDescending(session => session.CreatedAt)
            // Ids are time-ordered v7 Guids, so they break a tie in the same direction the timestamps would.
            .ThenByDescending(session => session.Id)
            .Select(session => new DefenseSessionListItemDto(
                session.Id,
                new HandoutEnvironmentTarget(
                    session.EnvironmentTarget!.HandoutEnvironment.Handout.ContentId,
                    session.EnvironmentTarget.HandoutEnvironment.ContentId),
                session.ProblemStatement,
                session.CreatedAt,
                session.Turns
                    .Where(turn => turn.Role == TranscriptRole.Candidate)
                    .OrderBy(turn => turn.Sequence)
                    .Select(turn => turn.Content)
                    .FirstOrDefault()))
            .ToListAsync(cancellationToken);
    }

    /// <inheritdoc/>
    public async Task DeleteAsync(Guid userId, Guid sessionId, CancellationToken cancellationToken = default)
    {
        // Serialize against this user's turns: an in-flight continue or rewind saves at the very end, so without
        // the gate a delete could remove the session first and turn that save into a foreign-key failure.
        using var turnLock = await turnGate.AcquireAsync(userId, cancellationToken);

        // A fresh context for this operation.
        await using var dbContext = await dbContextFactory.CreateDbContextAsync(cancellationToken);

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
    /// Runs the examiner over the session's current turns (which must end on a student turn), then stages its reply
    /// and the turn's spend row on the context. The caller's save writes them; this method does no database
    /// round-trip itself on the success path, so a slow turn doesn't hold a connection. If the client cancels the
    /// turn partway, it records what its model calls already cost to its own row, so aborting can't dodge the ceiling
    /// that keeps the feature free. Other failures propagate unrecorded: they're our fault, not the user's, and the
    /// process-wide spend tracker still sees their cost.
    /// </summary>
    /// <param name="dbContext">The operation's database context the spend row is staged on.</param>
    /// <param name="session">The session whose conversation to reply to.</param>
    /// <param name="userId">The user the spend is recorded against.</param>
    /// <param name="cancellationToken">A token to cancel the work.</param>
    private async Task RunExaminerAndStageAsync(
        MathCompsDbContext dbContext, DefenseSession session, Guid userId, CancellationToken cancellationToken)
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
            AppendTurn(session, TranscriptRole.Examiner, outcome.Reply, repliedAt);

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
                CreatedAt = repliedAt,
            });
        }
        // Only our own token firing is a client abort. An upstream HTTP/LLM timeout also throws
        // OperationCanceledException (as TaskCanceledException, off an internal token), but that's our fault, not the
        // user's, so it falls through this catch and propagates unrecorded.
        catch (OperationCanceledException) when (cancellationToken.IsCancellationRequested)
        {
            // The client aborted the turn, but its completed calls already cost us; record that against the user. A
            // turn cancelled before any call ran accrued nothing, so there's nothing to write.
            var accrued = usage.Accrued;
            if (accrued != ModelUsage.Zero)
                await WriteCancelledTurnSpendAsync(userId, accrued, (int)stopwatch.ElapsedMilliseconds);

            // Re-throw so the endpoint maps the cancellation unchanged.
            throw;
        }
    }

    /// <summary>
    /// Records a <see cref="DefenseSpend"/> for a turn the client cancelled, logging the cost its model calls already
    /// ran up so it counts against the user's ceiling. Writes on a fresh context with an uncancellable token, since
    /// the request's own context and token are already torn down by the abort.
    /// </summary>
    /// <param name="userId">The user the spend is recorded against.</param>
    /// <param name="accrued">What the turn's completed model calls cost before it was cancelled.</param>
    /// <param name="durationMs">How long the turn ran before it was cancelled, in milliseconds.</param>
    private async Task WriteCancelledTurnSpendAsync(Guid userId, ModelUsage accrued, int durationMs)
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
    private static void AppendTurn(DefenseSession session, TranscriptRole role, string content, DateTimeOffset createdAt)
        => session.Turns.Add(new DefenseTurn
        {
            SessionId = session.Id,
            Role = role,
            Content = content,
            Sequence = session.Turns.Count,
            CreatedAt = createdAt,
        });

    /// <summary>
    /// Builds the engine's transcript from a session's stored turns, in sequence order.
    /// </summary>
    /// <param name="turns">The session's turns.</param>
    /// <returns>The conversation as the engine reads it.</returns>
    private static Transcript BuildTranscript(IEnumerable<DefenseTurn> turns) =>
        new([.. turns.OrderBy(turn => turn.Sequence).Select(turn => new TranscriptTurn(turn.Role, turn.Content))]);

    /// <summary>
    /// Throws when the user's spend so far today has reached the per-user daily ceiling.
    /// </summary>
    /// <param name="dbContext">The operation's database context to query.</param>
    /// <param name="userId">The user to check.</param>
    /// <param name="cancellationToken">A token to cancel the query.</param>
    private async Task EnsureUnderSpendCeilingAsync(
        MathCompsDbContext dbContext, Guid userId, CancellationToken cancellationToken)
    {
        // The start of today, in UTC.
        var dayStart = new DateTimeOffset(DateTime.UtcNow.Date, TimeSpan.Zero);

        // Sum the user's spend since then.
        var spent = await dbContext.DefenseSpends
            .Where(spend => spend.UserId == userId && spend.CreatedAt >= dayStart)
            .SumAsync(spend => spend.Cost, cancellationToken);

        // Over the ceiling refuses the turn before any model call.
        if (spent >= _limits.DailySpendCeilingPerUser)
            throw new DefenseSpendLimitException();
    }

    /// <summary>
    /// Throws when a required input is missing or blank.
    /// </summary>
    /// <param name="value">The required input to check.</param>
    private static void EnsureNotBlank(string value)
    {
        // Null (a missing JSON field), empty, or whitespace-only is a bad request, not a server fault.
        if (string.IsNullOrWhiteSpace(value))
            throw new DefenseMessageEmptyException();
    }

    /// <summary>
    /// Throws when the environment being defended is missing or either half of it is blank.
    /// </summary>
    /// <param name="target">The environment to check, null when the request omitted it entirely.</param>
    private static void EnsureTargetPresent(HandoutEnvironmentTarget? target)
    {
        // A request that omits the target names nothing to defend, which is a bad request like any blank field.
        if (target is null)
            throw new DefenseMessageEmptyException();

        // Both halves are needed to locate the environment, so neither may be blank.
        EnsureNotBlank(target.HandoutContentId);
        EnsureNotBlank(target.EnvironmentId);
    }

    /// <summary>
    /// Throws when a value exceeds its length cap.
    /// </summary>
    /// <param name="value">The text to bound.</param>
    /// <param name="maxLength">The most characters allowed.</param>
    private static void EnsureWithinLength(string value, int maxLength)
    {
        // Over the cap is a bad request, not a server error.
        if (value.Length > maxLength)
            throw new DefenseMessageTooLongException();
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
    /// Projects a session to its client shape, turns in order.
    /// </summary>
    /// <param name="session">The session to project.</param>
    /// <param name="target">The environment the session defends.</param>
    /// <returns>The session's client shape.</returns>
    private static DefenseSessionDto ToSessionDto(DefenseSession session, HandoutEnvironmentTarget target) =>
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
    /// Finds the anchor row for the environment being defended, creating the handout's and the environment's anchor
    /// rows on demand when either is seen for the first time.
    /// </summary>
    /// <param name="dbContext">The operation's database context.</param>
    /// <param name="target">The environment to anchor.</param>
    /// <param name="cancellationToken">A token to cancel the work.</param>
    /// <returns>The environment anchor row's id.</returns>
    private static async Task<Guid> UpsertHandoutEnvironmentAsync(
        MathCompsDbContext dbContext, HandoutEnvironmentTarget target, CancellationToken cancellationToken)
    {
        // The handout the environment hangs off.
        var handoutId = await ContentAnchors.EnsureHandoutAsync(
            dbContext, target.HandoutContentId, cancellationToken);

        // The environment itself, scoped to that handout.
        return await ContentAnchors.EnsureHandoutEnvironmentAsync(
            dbContext, handoutId, target.EnvironmentId, cancellationToken);
    }

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
}
