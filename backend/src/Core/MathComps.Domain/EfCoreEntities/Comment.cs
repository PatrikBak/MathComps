namespace MathComps.Domain.EfCoreEntities;

/// <summary>
/// A user comment on content (Problem, Handout, NewsArticle).
/// </summary>
public class Comment
{
    /// <summary>
    /// Primary key (Guid v7).
    /// </summary>
    public Guid Id { get; set; } = Guid.CreateVersion7();

    /// <summary>
    /// Foreign key to the author.
    /// </summary>
    public required Guid AuthorId { get; set; }

    /// <summary>
    /// Navigation to the author.
    /// </summary>
    public User Author { get; set; } = null!;

    /// <summary>
    /// Parent comment ID for threading. Null for top-level.
    /// </summary>
    public Guid? ParentCommentId { get; set; }

    /// <summary>
    /// Navigation to parent comment.
    /// </summary>
    public Comment? ParentComment { get; set; }

    /// <summary>
    /// Child comments (replies).
    /// </summary>
    public ICollection<Comment> Replies { get; } = [];

    /// <summary>
    /// Previous version (for edit history). Null if original.
    /// </summary>
    public Guid? PreviousVersionId { get; set; }

    /// <summary>
    /// Navigation to the previous version.
    /// </summary>
    public Comment? PreviousVersion { get; set; }

    /// <summary>
    /// Markdown content.
    /// </summary>
    public required string Content { get; set; }

    /// <summary>
    /// Current status.
    /// </summary>
    public CommentStatus Status { get; set; } = CommentStatus.Active;

    /// <summary>
    /// When created.
    /// </summary>
    public DateTimeOffset CreatedAt { get; set; }

    /// <summary>
    /// Likes on this comment.
    /// </summary>
    public ICollection<CommentLike> Likes { get; } = [];
}
