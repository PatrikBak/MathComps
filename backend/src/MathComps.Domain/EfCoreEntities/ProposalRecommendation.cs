namespace MathComps.Domain.EfCoreEntities;

/// <summary>
/// One category the reviewers recommend a <see cref="Proposal"/> for.
/// </summary>
public class ProposalRecommendation
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
    /// FK to the category, one of the proposal's organization's.
    /// </summary>
    public required Guid CategoryId { get; set; }

    /// <summary>
    /// Navigation to the category.
    /// </summary>
    public OrganizationCategory Category { get; set; } = null!;
}
