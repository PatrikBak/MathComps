using MathComps.Infrastructure.Services.ConversationReview;
using MathComps.Infrastructure.Services.Defense;

namespace MathComps.Infrastructure.Services.Selection;

/// <summary>
/// Settles who reaches one defense conversation, or a note on one. A conversation about a proposal belongs to the
/// proposal's organization until a hosted group holding the proposal opens, and one about a deleted proposal stays
/// its organization's. Only that organization's members reach such a conversation, whoever held it: an admin among
/// them every one, anybody else the ones about a proposal that is not deleted. Every other conversation, such as one
/// about a handout, reaches the admins alone. The admins' lists of conversations leave out the ones an admin may not
/// reach (<see cref="SelectionRules.WhereReachableByAdmin"/>).
/// </summary>
public interface IConversationAccess
{
    /// <summary>
    /// Throws unless a viewer may reach a conversation.
    /// </summary>
    /// <param name="sessionId">The conversation.</param>
    /// <param name="viewer">Who is asking.</param>
    /// <param name="cancellationToken">A token to cancel the work.</param>
    /// <exception cref="DefenseSessionNotFoundException">
    /// Thrown when the viewer may not reach the conversation, or is no admin and no conversation has the id.
    /// </exception>
    Task EnsureConversationAsync(
        Guid sessionId, ConversationViewer viewer, CancellationToken cancellationToken = default);

    /// <summary>
    /// Throws unless a viewer may reach the conversation a note stands on.
    /// </summary>
    /// <param name="noteId">The note.</param>
    /// <param name="viewer">Who is asking.</param>
    /// <param name="cancellationToken">A token to cancel the work.</param>
    /// <exception cref="ReviewNoteNotFoundException">
    /// Thrown when no note has the id, or the viewer may not reach the conversation the note stands on.
    /// </exception>
    Task EnsureNoteAsync(Guid noteId, ConversationViewer viewer, CancellationToken cancellationToken = default);
}
