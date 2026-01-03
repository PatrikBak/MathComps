namespace MathComps.Domain.EfCoreEntities;

/// <summary>
/// Join table linking comments to problems.
/// </summary>
public class ProblemComment
{
    /// <summary>
    /// FK to the problem.
    /// </summary>
    public required Guid ProblemId { get; set; }

    /// <summary>
    /// Navigation to problem.
    /// </summary>
    public Problem Problem { get; set; } = null!;

    /// <summary>
    /// FK to the comment.
    /// </summary>
    public required Guid CommentId { get; set; }

    /// <summary>
    /// Navigation to comment.
    /// </summary>
    public Comment Comment { get; set; } = null!;
}
