namespace MathComps.Domain.EfCoreEntities;

/// <summary>
/// Join table linking comments to the conversation between the graders and one student about one problem the
/// student was graded on.
/// </summary>
/// <remarks>
/// Keyed on the entry and the problem rather than on a <see cref="HostedGrade"/> row, since grades are
/// append-only and every change of a mark writes a new row, which would split the conversation.
/// </remarks>
public class HostedGradeComment
{
    /// <summary>
    /// FK to the entry of the student the conversation is with.
    /// </summary>
    public required Guid EntryId { get; set; }

    /// <summary>
    /// Navigation to the entry.
    /// </summary>
    public HostedEntry Entry { get; set; } = null!;

    /// <summary>
    /// FK to the problem the conversation is about, one of the entry's round.
    /// </summary>
    public required Guid ProblemId { get; set; }

    /// <summary>
    /// Navigation to the problem.
    /// </summary>
    public Problem Problem { get; set; } = null!;

    /// <summary>
    /// FK to the comment.
    /// </summary>
    public required Guid CommentId { get; set; }

    /// <summary>
    /// Navigation to the comment.
    /// </summary>
    public Comment Comment { get; set; } = null!;
}
