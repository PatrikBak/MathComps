namespace MathComps.Domain.EfCoreEntities;

/// <summary>
/// Join table linking the reviewers' comments to the paper they discuss.
/// </summary>
public class SelectionPaperComment
{
    /// <summary>
    /// FK to the paper.
    /// </summary>
    public required Guid PaperId { get; set; }

    /// <summary>
    /// Navigation to the paper.
    /// </summary>
    public SelectionPaper Paper { get; set; } = null!;

    /// <summary>
    /// FK to the comment.
    /// </summary>
    public required Guid CommentId { get; set; }

    /// <summary>
    /// Navigation to the comment.
    /// </summary>
    public Comment Comment { get; set; } = null!;
}
