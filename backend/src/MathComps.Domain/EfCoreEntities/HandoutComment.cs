namespace MathComps.Domain.EfCoreEntities;

/// <summary>
/// Join table linking comments to handouts.
/// </summary>
public class HandoutComment
{
    /// <summary>
    /// FK to the handout.
    /// </summary>
    public required Guid HandoutId { get; set; }

    /// <summary>
    /// Navigation to handout.
    /// </summary>
    public Handout Handout { get; set; } = null!;

    /// <summary>
    /// FK to the comment.
    /// </summary>
    public required Guid CommentId { get; set; }

    /// <summary>
    /// Navigation to comment.
    /// </summary>
    public Comment Comment { get; set; } = null!;
}
