using MathComps.Domain.Contracts.Admin;
using MathComps.Domain.Contracts.Defense;
using MathComps.Domain.Contracts.Helpers;
using MathComps.Domain.Localization;

namespace MathComps.Infrastructure.Services.Admin;

/// <summary>
/// Reads the students' defense conversations as the admin's review queue, and marks a whole set of them read at
/// once. Which conversations it returns is scoped only by organization, by the rule
/// <see cref="Selection.IConversationAccess"/> states. What counts as read is scoped to the reviewer, because that
/// is their own place in the queue rather than a property of the conversation.
/// </summary>
public interface IAdminDefenseReviewService
{
    /// <summary>
    /// Reads one page of the review queue, the conversations spoken to most recently first.
    /// </summary>
    /// <param name="reviewerId">
    /// Whose read marks decide what counts as unread, and whose organizations decide which proposals' conversations
    /// show.
    /// </param>
    /// <param name="filter">Which conversations to show.</param>
    /// <param name="pageNumber">1-based page index to retrieve; values outside the range are clamped.</param>
    /// <param name="language">The language to name each conversation's problem in.</param>
    /// <param name="cancellationToken">A token to cancel the work.</param>
    /// <returns>The page of conversations, as big as the server serves them.</returns>
    Task<PagedList<AdminDefenseConversationDto>> GetQueueAsync(
        Guid reviewerId,
        AdminDefenseQueueFilter filter,
        int pageNumber,
        Language language,
        CancellationToken cancellationToken = default);

    /// <summary>
    /// Reads what the queue's filters can be set to.
    /// </summary>
    /// <param name="reviewerId">Whose organizations decide which proposals' conversations count.</param>
    /// <param name="language">The language to name each problem in.</param>
    /// <param name="cancellationToken">A token to cancel the work.</param>
    /// <returns>
    /// Every student, problem, and set of examiner settings a conversation the reviewer reads exists under.
    /// </returns>
    Task<AdminDefenseFilterOptionsDto> GetFilterOptionsAsync(
        Guid reviewerId, Language language, CancellationToken cancellationToken = default);

    /// <summary>
    /// Reads the conversations one student held against one problem, oldest first. Where somebody grades them on
    /// it, which of the conversations count toward the grade comes along, with where the grade stands and what they
    /// said about their solution.
    /// </summary>
    /// <param name="reviewerId">Whose organizations decide which proposals' conversations show.</param>
    /// <param name="userId">The student.</param>
    /// <param name="target">The problem the conversations were held against.</param>
    /// <param name="cancellationToken">A token to cancel the work.</param>
    /// <returns>The conversations, and how the student is graded on the problem.</returns>
    Task<AuthorConversationsDto> GetStudentConversationsAsync(
        Guid reviewerId, Guid userId, DefenseTarget target, CancellationToken cancellationToken = default);

    /// <summary>
    /// Stamps a whole set of conversations as read as of now, which is what clearing a backlog is. An id naming
    /// no conversation is skipped rather than refused, since a set is marked for the sake of the conversations in
    /// it and one gone since the queue was read says nothing about the rest. Marking the same set twice is the
    /// same outcome as marking it once.
    /// </summary>
    /// <param name="reviewerId">The reviewer marking them.</param>
    /// <param name="sessionIds">The conversations to mark, bounded by the caller.</param>
    /// <param name="cancellationToken">A token to cancel the work.</param>
    Task MarkManyReadAsync(
        Guid reviewerId,
        IReadOnlyCollection<Guid> sessionIds,
        CancellationToken cancellationToken = default);
}

