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
/// <param name="turnGate">Serializes a single user's turns.</param>
public class DefenseSessionService(
    IDbContextFactory<MathCompsDbContext> dbContextFactory, IExaminer examiner, IOptions<DefenseLimits> limits,
    IDefenseUserTurnGate turnGate)
    : IDefenseSessionService
{
    /// <summary>
    /// The input, turn, and spend caps.
    /// </summary>
    private readonly DefenseLimits _limits = limits.Value;

    /// <inheritdoc/>
    public async Task<DefenseSessionDto> StartAsync(
        Guid userId, StartDefenseRequest request, CancellationToken cancellationToken = default)
    {
        // Every field a start needs must be present and non-blank; a missing one (null through JSON) or a blank one
        // is a bad request, not a server fault.
        EnsureNotBlank(request.ProblemKey);
        EnsureNotBlank(request.Statement);
        EnsureNotBlank(request.Reference);
        EnsureNotBlank(request.Opener);
        EnsureNotBlank(request.Content);

        // Bound each input before doing anything with it.
        EnsureWithinLength(request.ProblemKey, _limits.MaxProblemKeyChars);
        EnsureWithinLength(request.Statement, _limits.MaxStatementChars);
        EnsureWithinLength(request.Reference, _limits.MaxReferenceChars);
        EnsureWithinLength(request.Opener, _limits.MaxOpenerChars);
        EnsureWithinLength(request.Content, _limits.MaxCandidateChars);

        // Serialize this user's turns for the rest of the operation, so concurrent starts each see the other's spend.
        using var turnLock = await turnGate.AcquireAsync(userId, cancellationToken);

        // A fresh context for this operation.
        await using var dbContext = await dbContextFactory.CreateDbContextAsync(cancellationToken);

        // Refuse the turn if the user is already over their spend ceiling.
        await EnsureUnderSpendCeilingAsync(dbContext, userId, cancellationToken);

        // One timestamp for the session and its seed turns.
        var seededAt = DateTimeOffset.UtcNow;

        // A fresh session holding the problem and its reference for this and later turns.
        var session = new DefenseSession
        {
            UserId = userId,
            ProblemKey = request.ProblemKey,
            ProblemStatement = request.Statement,
            ProblemReference = request.Reference,
            CreatedAt = seededAt,
        };

        // Seed the examiner's opener, a canned greeting rather than an LLM turn.
        AppendTurn(session, TranscriptRole.Examiner, request.Opener, seededAt);

        // Seed the student's first message.
        AppendTurn(session, TranscriptRole.Candidate, request.Content, seededAt);

        // Run the engine over the seed and stage its reply and spend row.
        await RunExaminerAndStageAsync(dbContext, session, userId, cancellationToken);

        // Track the new session.
        dbContext.DefenseSessions.Add(session);

        // Persist the session, its turns, and the spend row in one write.
        await dbContext.SaveChangesAsync(cancellationToken);

        // Hand back the full conversation.
        return ToDto(session);
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

        // Load the session with its turns.
        var session = await dbContext.DefenseSessions
            .Include(defenseSession => defenseSession.Turns)
            .FirstOrDefaultAsync(defenseSession => defenseSession.Id == sessionId, cancellationToken);

        // Treat another user's session, or a missing one, as absent.
        if (session is null || session.UserId != userId)
            throw new DefenseSessionNotFoundException();

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
        return ToDto(session);
    }

    /// <inheritdoc/>
    public async Task<IReadOnlyList<DefenseSessionDto>> ListAsync(
        Guid userId, string problemKey, CancellationToken cancellationToken = default)
    {
        // A fresh context for this operation.
        await using var dbContext = await dbContextFactory.CreateDbContextAsync(cancellationToken);

        // The user's sessions for this problem, oldest first, each with its turns.
        var sessions = await dbContext.DefenseSessions
            .AsNoTracking()
            .Where(session => session.UserId == userId && session.ProblemKey == problemKey)
            .OrderBy(session => session.CreatedAt)
            .Select(session => new { session.Id, session.ProblemKey, Turns = session.Turns.ToList() })
            .ToListAsync(cancellationToken);

        // Project each to its client shape.
        return [.. sessions.Select(session => new DefenseSessionDto(
            session.Id, session.ProblemKey, ToTurnDtos(session.Turns)))];
    }

    /// <inheritdoc/>
    public async Task DeleteAsync(Guid userId, Guid sessionId, CancellationToken cancellationToken = default)
    {
        // A fresh context for this operation.
        await using var dbContext = await dbContextFactory.CreateDbContextAsync(cancellationToken);

        // Load the session.
        var session = await dbContext.DefenseSessions
            .FirstOrDefaultAsync(defenseSession => defenseSession.Id == sessionId, cancellationToken);

        // Treat another user's session, or a missing one, as absent.
        if (session is null || session.UserId != userId)
            throw new DefenseSessionNotFoundException();

        // Mark the session for removal; the cascade drops its turns, the spend rows are independent and stay.
        dbContext.DefenseSessions.Remove(session);

        // Commit the delete.
        await dbContext.SaveChangesAsync(cancellationToken);
    }

    /// <inheritdoc/>
    public async Task RewindAsync(
        Guid userId, Guid sessionId, int keepThroughSequence, CancellationToken cancellationToken = default)
    {
        // Serialize against this user's turns: a continue builds its turn in memory and saves at the very end,
        // so without the gate this delete could interleave and leave the sequence non-contiguous.
        using var turnLock = await turnGate.AcquireAsync(userId, cancellationToken);

        // A fresh context for this operation.
        await using var dbContext = await dbContextFactory.CreateDbContextAsync(cancellationToken);

        // Load the session for the ownership check.
        var session = await dbContext.DefenseSessions
            .FirstOrDefaultAsync(defenseSession => defenseSession.Id == sessionId, cancellationToken);

        // Treat another user's session, or a missing one, as absent.
        if (session is null || session.UserId != userId)
            throw new DefenseSessionNotFoundException();

        // The role of the turn to keep as the new last one, or null when the sequence is out of range.
        var keptRole = await dbContext.DefenseTurns
            .Where(turn => turn.SessionId == sessionId && turn.Sequence == keepThroughSequence)
            .Select(turn => (TranscriptRole?)turn.Role)
            .FirstOrDefaultAsync(cancellationToken);

        // The cut point must land on an existing examiner turn, so the rewound conversation awaits the student.
        if (keptRole != TranscriptRole.Examiner)
            throw new DefenseRewindTargetException();

        // Delete the tail in one statement: the doomed rows are never loaded, and the kept prefix stays a
        // contiguous 0..keepThroughSequence, so a later append can't collide with the (session, sequence) index.
        await dbContext.DefenseTurns
            .Where(turn => turn.SessionId == sessionId && turn.Sequence > keepThroughSequence)
            .ExecuteDeleteAsync(cancellationToken);
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
    /// Projects a session to its client shape, turns in order and roles as wire strings.
    /// </summary>
    /// <param name="session">The session to project.</param>
    /// <returns>The session's client shape.</returns>
    private static DefenseSessionDto ToDto(DefenseSession session) =>
        new(session.Id, session.ProblemKey, ToTurnDtos(session.Turns));

    /// <summary>
    /// Projects a session's turns to their client shape, in sequence order and roles as wire strings.
    /// </summary>
    /// <param name="turns">The turns to project.</param>
    /// <returns>The turns' client shapes.</returns>
    private static IReadOnlyList<DefenseTurnDto> ToTurnDtos(IEnumerable<DefenseTurn> turns) =>
        [.. turns
            .OrderBy(turn => turn.Sequence)
            .Select(turn => new DefenseTurnDto(ToWireRole(turn.Role), turn.Content, turn.CreatedAt))];

    /// <summary>
    /// Maps a transcript role to its wire string.
    /// </summary>
    /// <param name="role">The role to map.</param>
    /// <returns>The client's role string.</returns>
    private static string ToWireRole(TranscriptRole role) => role switch
    {
        TranscriptRole.Candidate => "student",
        TranscriptRole.Examiner => "examiner",
        _ => throw new ArgumentOutOfRangeException(nameof(role), role, "Unknown transcript role."),
    };
}
