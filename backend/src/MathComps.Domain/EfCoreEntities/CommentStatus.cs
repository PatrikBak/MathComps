namespace MathComps.Domain.EfCoreEntities;

/// <summary>
/// Status of a comment in the system.
/// </summary>
public enum CommentStatus
{
    /// <summary>
    /// Normal visible comment.
    /// </summary>
    Active,

    /// <summary>
    /// Soft-deleted. Shows "[deleted]" placeholder.
    /// </summary>
    Deleted,

    /// <summary>
    /// Replaced by newer edit. Hidden but preserved.
    /// </summary>
    Superseded
}
