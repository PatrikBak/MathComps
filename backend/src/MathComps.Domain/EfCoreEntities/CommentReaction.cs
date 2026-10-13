namespace MathComps.Domain.EfCoreEntities;

/// <summary>
/// A user's reaction on a comment. A user holds at most one per comment.
/// </summary>
public class CommentReaction
{
    /// <summary>
    /// FK to the user who reacted.
    /// </summary>
    public required Guid UserId { get; set; }

    /// <summary>
    /// Navigation to user.
    /// </summary>
    public User User { get; set; } = null!;

    /// <summary>
    /// FK to the comment reacted to.
    /// </summary>
    public required Guid CommentId { get; set; }

    /// <summary>
    /// Navigation to comment.
    /// </summary>
    public Comment Comment { get; set; } = null!;

    /// <summary>
    /// Which of the reactions it is.
    /// </summary>
    public required CommentReactionKind Kind { get; set; }

    /// <summary>
    /// When the reaction was given.
    /// </summary>
    public required DateTimeOffset CreatedAt { get; set; }
}
