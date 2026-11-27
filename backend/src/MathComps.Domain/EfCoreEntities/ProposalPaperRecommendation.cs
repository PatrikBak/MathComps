namespace MathComps.Domain.EfCoreEntities;

/// <summary>
/// One paper with no category the reviewers recommend a <see cref="Proposal"/> for. Such a paper stands for a
/// competition with no level, so it is its own category.
/// </summary>
public class ProposalPaperRecommendation
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
    /// FK to the paper, one with no category on a board of the proposal's organization.
    /// </summary>
    public required Guid PaperId { get; set; }

    /// <summary>
    /// Navigation to the paper.
    /// </summary>
    public SelectionPaper Paper { get; set; } = null!;
}
