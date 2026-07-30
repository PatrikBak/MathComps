using MathComps.Domain.EfCoreEntities;
using MathComps.Infrastructure.Options;
using MathComps.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Options;

namespace MathComps.Infrastructure.Services.Defense;

/// <summary>
/// Implements <see cref="IDefenseFeedbackService"/> over the database. Every operation goes through
/// <see cref="DefenseSessionWrites.ToOwnedSessionAsync"/> and then straight to the database, independent of
/// the examiner engine.
/// </summary>
/// <remarks>
/// Every operation takes the user's turn lock, the withdrawals included, so that a recording already in flight
/// can't outlive the withdrawal that was meant to take it back.
/// </remarks>
/// <param name="dbContextFactory">The factory minting each operation's database context.</param>
/// <param name="limits">The input caps, of which the comment length is read here.</param>
/// <param name="turnGate">Serializes a single user's turns.</param>
public class DefenseFeedbackService(
    IDbContextFactory<MathCompsDbContext> dbContextFactory,
    IOptions<DefenseLimits> limits,
    IDefenseUserTurnGate turnGate)
    : IDefenseFeedbackService
{
    /// <summary>
    /// The input caps.
    /// </summary>
    private readonly DefenseLimits _limits = limits.Value;

    /// <inheritdoc/>
    public async Task ReportTurnAsync(
        Guid userId, Guid sessionId, Guid turnId, IReadOnlyList<DefenseReportCategory> categories, string? comment,
        CancellationToken cancellationToken = default)
    {
        // A report that holds nothing against the reply isn't a report, which is a bad request, not a server fault.
        if (categories is [])
            throw new DefenseFeedbackValueException();

        // Naming the same way twice says nothing twice.
        var reportedCategories = categories.Distinct().ToList();

        // A way the reply went wrong that the contract doesn't name is a bad request, and refusing it here is what
        // keeps it from reaching a column that has no label for it.
        if (reportedCategories.Any(category => !Enum.IsDefined(category)))
            throw new DefenseFeedbackValueException();

        // The student's own account of the fault, reduced to the text it carries.
        var reportedComment = NormalizeComment(comment);

        // Blaming something off the list without saying what it was leaves nothing to act on.
        if (reportedCategories.Contains(DefenseReportCategory.Other) && reportedComment is null)
            throw new DefenseFeedbackValueException();

        // Bound what they wrote.
        EnsureCommentWithinLength(reportedComment);

        // Write it against the conversation, once it is settled that the conversation is the caller's.
        await DefenseSessionWrites.ToOwnedSessionAsync(
            dbContextFactory, turnGate, userId, sessionId, async dbContext =>
        {
            // Who authored the turn being reported, absent when this conversation holds no such turn.
            var reportedRole = await GetTurnRoleByIdAsync(dbContext, sessionId, turnId, cancellationToken);

            // Only the examiner's replies can be reported.
            if (reportedRole != TranscriptRole.Examiner)
                throw new DefenseReportTargetException();

            // One timestamp, so a first report reads as never revised.
            var reportedAt = DateTimeOffset.UtcNow;

            // Record it as the reply's one and only report. Keeping the key and the first stamp out of the
            // update leaves a revision the same row, still saying when the student first complained.
            await dbContext.DefenseTurnReports
                .Upsert(new DefenseTurnReport
                {
                    SessionId = sessionId,
                    TurnId = turnId,
                    Categories = reportedCategories,
                    Comment = reportedComment,
                    CreatedAt = reportedAt,
                    UpdatedAt = reportedAt,
                })
                .On(report => report.TurnId)
                .Exclude(report => new { report.CreatedAt, report.Id })
                .RunAsync(cancellationToken);
        }, cancellationToken);
    }

    /// <inheritdoc/>
    public async Task SubmitFeedbackAsync(
        Guid userId, Guid sessionId, DefenseOutcome outcome, string? comment,
        CancellationToken cancellationToken = default)
    {
        // A verdict the contract doesn't name is a bad request, and refusing it here is what keeps it from
        // reaching a column that has no label for it.
        if (!Enum.IsDefined(outcome))
            throw new DefenseFeedbackValueException();

        // What the student wrote, reduced to the text it carries.
        var answeredComment = NormalizeComment(comment);

        // Saying the conversation went somewhere off the list without saying where leaves nothing to read.
        if (outcome == DefenseOutcome.SomethingElse && answeredComment is null)
            throw new DefenseFeedbackValueException();

        // Bound what they wrote.
        EnsureCommentWithinLength(answeredComment);

        // Write it against the conversation, once it is settled that the conversation is the caller's.
        await DefenseSessionWrites.ToOwnedSessionAsync(
            dbContextFactory, turnGate, userId, sessionId, async dbContext =>
        {
            // One timestamp, so a first answer reads as never revised.
            var answeredAt = DateTimeOffset.UtcNow;

            // Record the answer as the session's one and only. Keeping the first stamp out of the update leaves
            // it saying when the student first spoke.
            await dbContext.DefenseSessionFeedbacks
                .Upsert(new DefenseSessionFeedback
                {
                    SessionId = sessionId,
                    Outcome = outcome,
                    Comment = answeredComment,
                    CreatedAt = answeredAt,
                    UpdatedAt = answeredAt,
                })
                .On(feedback => feedback.SessionId)
                .Exclude(feedback => feedback.CreatedAt)
                .RunAsync(cancellationToken);
        }, cancellationToken);
    }

    /// <inheritdoc/>
    public async Task WithdrawTurnReportAsync(
        Guid userId, Guid sessionId, Guid turnId, CancellationToken cancellationToken = default)
    {
        // Reach into the conversation, once it is settled that it is the caller's.
        await DefenseSessionWrites.ToOwnedSessionAsync(
            dbContextFactory, turnGate, userId, sessionId, async dbContext =>
        {
            // Drop what was held against the reply. Naming a reply that carries nothing, or one a rewind has
            // since taken, leaves the student exactly where they asked to be, so it passes for done.
            await dbContext.DefenseTurnReports
                .Where(report => report.SessionId == sessionId && report.TurnId == turnId)
                .ExecuteDeleteAsync(cancellationToken);
        }, cancellationToken);
    }

    /// <inheritdoc/>
    public async Task WithdrawFeedbackAsync(
        Guid userId, Guid sessionId, CancellationToken cancellationToken = default)
    {
        // Reach into the conversation, once it is settled that it is the caller's.
        await DefenseSessionWrites.ToOwnedSessionAsync(
            dbContextFactory, turnGate, userId, sessionId, async dbContext =>
        {
            // Drop the answer. A conversation nobody has answered for is where the student asked to be, so it
            // passes for done.
            await dbContext.DefenseSessionFeedbacks
                .Where(feedback => feedback.SessionId == sessionId)
                .ExecuteDeleteAsync(cancellationToken);
        }, cancellationToken);
    }

    /// <summary>
    /// Reads who authored one of a session's turns. Scoping the lookup to the session is what stops a turn id
    /// from another conversation resolving here.
    /// </summary>
    /// <param name="dbContext">The operation's database context.</param>
    /// <param name="sessionId">The session the turn must belong to.</param>
    /// <param name="turnId">The turn's identifier.</param>
    /// <param name="cancellationToken">A token to cancel the work.</param>
    /// <returns>The turn's role, or null when the session holds no such turn.</returns>
    private static async Task<TranscriptRole?> GetTurnRoleByIdAsync(
        MathCompsDbContext dbContext, Guid sessionId, Guid turnId, CancellationToken cancellationToken)
    {
        // The role of that turn, absent when the session holds no turn under the id.
        return await dbContext.DefenseTurns
            .Where(turn => turn.SessionId == sessionId && turn.Id == turnId)
            .Select(turn => (TranscriptRole?)turn.Role)
            .FirstOrDefaultAsync(cancellationToken);
    }

    /// <summary>
    /// Throws when a comment exceeds its length cap.
    /// </summary>
    /// <param name="comment">The comment to bound, null when none was given.</param>
    private void EnsureCommentWithinLength(string? comment)
    {
        // Over the cap is a bad request, not a server error.
        if (comment is not null && comment.Length > _limits.MaxFeedbackCommentChars)
            throw new DefenseFeedbackCommentTooLongException();
    }

    /// <summary>
    /// Reduces a comment to the text it carries, so a whitespace-only one is stored as no comment at all.
    /// </summary>
    /// <param name="comment">The comment as the client sent it.</param>
    /// <returns>The trimmed comment, or null when it carries nothing.</returns>
    private static string? NormalizeComment(string? comment)
    {
        // An absent or blank comment is the same thing: the student said nothing.
        if (string.IsNullOrWhiteSpace(comment))
            return null;

        // Otherwise keep the text without its surrounding whitespace.
        return comment.Trim();
    }
}
