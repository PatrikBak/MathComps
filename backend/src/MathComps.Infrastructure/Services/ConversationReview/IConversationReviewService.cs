using MathComps.Domain.Contracts.ConversationReview;
using MathComps.Domain.Localization;

namespace MathComps.Infrastructure.Services.ConversationReview;

/// <summary>
/// Reads one defense conversation back for review, and records how far a reviewer has read it. What counts as read
/// is scoped to the reviewer, because that is their own place in the conversation rather than a property of it.
/// </summary>
public interface IConversationReviewService
{
    /// <summary>
    /// Reads one conversation in full, along with the read stamp as it stood before this read.
    /// </summary>
    /// <param name="reviewerId">Whose read stamp to carry back with it.</param>
    /// <param name="sessionId">The conversation to read.</param>
    /// <param name="language">The language to name its problem in.</param>
    /// <param name="cancellationToken">A token to cancel the work.</param>
    /// <returns>The whole conversation.</returns>
    Task<ConversationDetailDto> GetDetailAsync(
        Guid reviewerId, Guid sessionId, Language language, CancellationToken cancellationToken = default);

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
    /// Moves one reviewer's record of having read a conversation to just before one of its turns, leaving that turn
    /// and everything after it to be read again. A turn is named rather than a moment, so where the record lands is
    /// the conversation's own to decide. Where it stood before doesn't hold it back: naming a turn it already sits
    /// past settles everything up to that turn. Naming the earliest turn leaves nothing read.
    /// </summary>
    /// <param name="reviewerId">The reviewer moving their record.</param>
    /// <param name="sessionId">The conversation to move it in.</param>
    /// <param name="turnId">The turn to leave unread, along with every turn after it.</param>
    /// <param name="cancellationToken">A token to cancel the work.</param>
    Task MarkUnreadFromAsync(
        Guid reviewerId, Guid sessionId, Guid turnId, CancellationToken cancellationToken = default);
}

/// <summary>
/// Thrown when a reviewer's reading is moved back to a turn the conversation it is about doesn't hold.
/// </summary>
public sealed class ReviewTargetException() : Exception("The turn to pick up from is not valid");
