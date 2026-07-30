using MathComps.Domain.EfCoreEntities;

namespace MathComps.Infrastructure.Services.Defense;

/// <summary>
/// Records what a student says about a defense conversation: what they hold against one examiner reply that went
/// wrong, and what the conversation as a whole did for them. Either can be taken back as well as revised, since
/// what they said about her is theirs. All of it is scoped to a session the caller owns.
/// </summary>
public interface IDefenseFeedbackService
{
    /// <summary>
    /// Records what the student holds against one examiner reply, replacing anything they said about it before so
    /// it always reads as their current complaint. Only a reply can be reported, and the session must belong to
    /// the user.
    /// </summary>
    /// <param name="userId">The user the session must belong to.</param>
    /// <param name="sessionId">The session the reported reply was given in.</param>
    /// <param name="turnId">The reported reply's identifier.</param>
    /// <param name="categories">Every way the reply went wrong; at least one.</param>
    /// <param name="comment">
    /// The student's own account of what went wrong, or null when they gave none. Required alongside
    /// <see cref="DefenseReportCategory.Other"/>, which says nothing on its own.
    /// </param>
    /// <param name="cancellationToken">A token to cancel the work.</param>
    Task ReportTurnAsync(
        Guid userId, Guid sessionId, Guid turnId, IReadOnlyList<DefenseReportCategory> categories, string? comment,
        CancellationToken cancellationToken = default);

    /// <summary>
    /// Records what the conversation did for the student, replacing anything they said before so it always reads
    /// as their current verdict. The session must belong to the user.
    /// </summary>
    /// <param name="userId">The user the session must belong to.</param>
    /// <param name="sessionId">The session being answered for.</param>
    /// <param name="outcome">What the examiner did for them.</param>
    /// <param name="comment">
    /// What they say in their own words, or null when they let the outcome stand alone. Required alongside
    /// <see cref="DefenseOutcome.SomethingElse"/>, which says nothing on its own.
    /// </param>
    /// <param name="cancellationToken">A token to cancel the work.</param>
    Task SubmitFeedbackAsync(
        Guid userId, Guid sessionId, DefenseOutcome outcome, string? comment,
        CancellationToken cancellationToken = default);

    /// <summary>
    /// Takes back what the student held against one examiner reply, leaving the reply carrying nothing. Holding
    /// nothing against it already is the same outcome, so asking twice is no different from asking once, and
    /// naming a reply the conversation doesn't hold at all reaches the same place rather than being refused the
    /// way recording against one would be. The session must belong to the user.
    /// </summary>
    /// <param name="userId">The user the session must belong to.</param>
    /// <param name="sessionId">The session the reported reply was given in.</param>
    /// <param name="turnId">The reply to stop holding anything against.</param>
    /// <param name="cancellationToken">A token to cancel the work.</param>
    Task WithdrawTurnReportAsync(
        Guid userId, Guid sessionId, Guid turnId, CancellationToken cancellationToken = default);

    /// <summary>
    /// Takes back what the student said the conversation came to, leaving it unanswered. An unanswered
    /// conversation already is the same outcome, so asking twice is no different from asking once. The session
    /// must belong to the user.
    /// </summary>
    /// <param name="userId">The user the session must belong to.</param>
    /// <param name="sessionId">The session to leave unanswered.</param>
    /// <param name="cancellationToken">A token to cancel the work.</param>
    Task WithdrawFeedbackAsync(Guid userId, Guid sessionId, CancellationToken cancellationToken = default);
}

/// <summary>
/// Thrown when feedback says nothing the contract can take: a report naming no way the reply went wrong, a report
/// blaming <see cref="DefenseReportCategory.Other"/> without saying what happened, an answer picking
/// <see cref="DefenseOutcome.SomethingElse"/> without saying what it was, or an outcome or category outside the
/// ones the contract defines.
/// </summary>
public sealed class DefenseFeedbackValueException() : Exception("The feedback says nothing");

/// <summary>
/// Thrown when a feedback comment exceeds its configured length cap.
/// </summary>
public sealed class DefenseFeedbackCommentTooLongException() : Exception("The comment is too long");

/// <summary>
/// Thrown when a report names a turn the session doesn't hold, or one the student authored, so there is no reply
/// to report.
/// </summary>
public sealed class DefenseReportTargetException() : Exception("The reported turn is not valid");
