namespace MathComps.Domain.EfCoreEntities;

/// <summary>
/// Join table linking the reviewers' comments to the proposal they discuss.
/// </summary>
/// <remarks>
/// Kept apart from <see cref="ProblemComment"/>, whose thread the archive shows once the problem is published,
/// so the reviewers' discussion of a problem never reaches its readers.
/// </remarks>
public class ProposalComment
{
    /// <summary>
    /// FK to the proposal, which is its problem's id.
    /// </summary>
    public required Guid ProposalId { get; set; }

    /// <summary>
    /// Navigation to the proposal.
    /// </summary>
    public Proposal Proposal { get; set; } = null!;

    /// <summary>
    /// FK to the comment.
    /// </summary>
    public required Guid CommentId { get; set; }

    /// <summary>
    /// Navigation to the comment.
    /// </summary>
    public Comment Comment { get; set; } = null!;
}
