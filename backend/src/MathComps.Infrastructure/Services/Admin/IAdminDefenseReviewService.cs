using MathComps.Domain.Contracts.Admin;
using MathComps.Domain.Contracts.Helpers;

namespace MathComps.Infrastructure.Services.Admin;

/// <summary>
/// Reads every student's defense conversations for review, and records which of them a reviewer has read. Which
/// conversations it returns is scoped to nobody, since a reviewer reads all of them; only what counts as read is,
/// because that is the reviewer's own place in the queue rather than a property of the conversation.
/// </summary>
public interface IAdminDefenseReviewService
{
    /// <summary>
    /// Reads one page of the review queue, the conversations spoken to most recently first.
    /// </summary>
    /// <param name="reviewerId">Whose read marks decide what counts as unread.</param>
    /// <param name="filter">Which conversations to show.</param>
    /// <param name="pageNumber">1-based page index to retrieve; values outside the range are clamped.</param>
    /// <param name="cancellationToken">A token to cancel the work.</param>
    /// <returns>The page of conversations, as big as the server serves them.</returns>
    Task<PagedList<AdminDefenseConversationDto>> GetQueueAsync(
        Guid reviewerId,
        AdminDefenseQueueFilter filter,
        int pageNumber,
        CancellationToken cancellationToken = default);

    /// <summary>
    /// Reads what the queue's filters can be set to.
    /// </summary>
    /// <param name="cancellationToken">A token to cancel the work.</param>
    /// <returns>Every student, problem, and set of examiner settings a conversation exists under.</returns>
    Task<AdminDefenseFilterOptionsDto> GetFilterOptionsAsync(CancellationToken cancellationToken = default);

    /// <summary>
    /// Reads one conversation in full, along with the read stamp as it stood before this read.
    /// </summary>
    /// <param name="reviewerId">Whose read stamp to carry back with it.</param>
    /// <param name="sessionId">The conversation to read.</param>
    /// <param name="cancellationToken">A token to cancel the work.</param>
    /// <returns>The whole conversation.</returns>
    Task<AdminDefenseDetailDto> GetDetailAsync(
        Guid reviewerId, Guid sessionId, CancellationToken cancellationToken = default);

    /// <summary>
    /// Records that a reviewer has read a conversation as of now, replacing any earlier stamp of theirs. Turns
    /// arriving after this bring it back to be read again.
    /// </summary>
    /// <param name="reviewerId">The reviewer who read it.</param>
    /// <param name="sessionId">The conversation that was read.</param>
    /// <param name="cancellationToken">A token to cancel the work.</param>
    Task MarkReadAsync(Guid reviewerId, Guid sessionId, CancellationToken cancellationToken = default);

    /// <summary>
    /// Takes back one reviewer's record of having read a conversation, leaving it as though they never had. Having
    /// not read it already is the same outcome, so asking twice is no different from asking once.
    /// </summary>
    /// <param name="reviewerId">The reviewer taking it back.</param>
    /// <param name="sessionId">The conversation to leave unread.</param>
    /// <param name="cancellationToken">A token to cancel the work.</param>
    Task MarkUnreadAsync(Guid reviewerId, Guid sessionId, CancellationToken cancellationToken = default);

    /// <summary>
    /// Marks a whole set of conversations at once, which is what clearing a backlog and taking that back are.
    /// An id naming no conversation is skipped rather than refused, since a set is marked for the sake of the
    /// conversations in it and one gone since the queue was read says nothing about the rest. Marking the same
    /// set twice is the same outcome as marking it once.
    /// </summary>
    /// <param name="reviewerId">The reviewer marking them.</param>
    /// <param name="sessionIds">The conversations to mark, bounded by the caller.</param>
    /// <param name="read">True to stamp them as read as of now, false to take this reviewer's stamps back.</param>
    /// <param name="cancellationToken">A token to cancel the work.</param>
    Task MarkManyAsync(
        Guid reviewerId,
        IReadOnlyCollection<Guid> sessionIds,
        bool read,
        CancellationToken cancellationToken = default);
}
