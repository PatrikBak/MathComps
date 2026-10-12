using MathComps.Infrastructure.Services.ConversationReview;


namespace MathComps.Infrastructure.Services.Selection;

/// <summary>
/// Settles whether a defense conversation is one the reviewers held about a proposal the selection still holds,
/// which is every conversation the selection reads back and nothing else. A problem can carry other conversations
/// into the pool, such as the students' ones about a problem taken back off a paper, and those stay out.
/// </summary>
public interface IProposalConversations
{
    /// <summary>
    /// Throws unless a conversation is one the reviewers held about a proposal the selection still holds.
    /// </summary>
    /// <param name="sessionId">The conversation.</param>
    /// <param name="cancellationToken">A token to cancel the work.</param>
    /// <exception cref="SelectionTargetNotFoundException">
    /// Thrown when no conversation has the id, or it is not one the reviewers held about a proposal the selection
    /// still holds.
    /// </exception>
    Task EnsureConversationAsync(Guid sessionId, CancellationToken cancellationToken = default);

    /// <summary>
    /// Throws unless a note stands on a conversation the reviewers held about a proposal the selection still holds.
    /// </summary>
    /// <param name="noteId">The note.</param>
    /// <param name="cancellationToken">A token to cancel the work.</param>
    /// <exception cref="ReviewNoteNotFoundException">Thrown when no note has the id.</exception>
    /// <exception cref="SelectionTargetNotFoundException">
    /// Thrown when the conversation the note stands on is not one the reviewers held about a proposal the selection
    /// still holds.
    /// </exception>
    Task EnsureNoteAsync(Guid noteId, CancellationToken cancellationToken = default);
}
