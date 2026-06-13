namespace MathComps.Domain.EfCoreEntities;

/// <summary>
/// A user's like on a comment.
/// </summary>
public class CommentLike
{
    /// <summary>
    /// FK to the user who liked.
    /// </summary>
    public required Guid UserId { get; set; }

    /// <summary>
    /// Navigation to user.
    /// </summary>
    public User User { get; set; } = null!;

    /// <summary>
    /// FK to the liked comment.
    /// </summary>
    public required Guid CommentId { get; set; }

    /// <summary>
    /// Navigation to comment.
    /// </summary>
    public Comment Comment { get; set; } = null!;

    /// <summary>
    /// When the like was created.
    /// </summary>
    public required DateTimeOffset CreatedAt { get; set; }
}
