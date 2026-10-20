using System.ComponentModel.DataAnnotations;
using MathComps.Domain.Contracts.Competitions;

namespace MathComps.Domain.EfCoreEntities;

/// <summary>
/// One category an <see cref="Organization"/> picks problems for: what its reviewers recommend a proposal for, and
/// what a paper on its boards fills.
/// </summary>
public class OrganizationCategory
{
    /// <summary>
    /// Primary key (Guid v7).
    /// </summary>
    public Guid Id { get; set; } = Guid.CreateVersion7();

    /// <summary>
    /// FK to the organization listing it.
    /// </summary>
    public required Guid OrganizationId { get; set; }

    /// <summary>
    /// Navigation to the organization.
    /// </summary>
    public Organization Organization { get; set; } = null!;

    /// <summary>
    /// Where the category stands among its organization's, from zero.
    /// </summary>
    public required int Position { get; set; }

    /// <summary>
    /// What the organization calls it, unique among its categories, and how the category is named everywhere outside
    /// the database.
    /// </summary>
    [MaxLength(50)]
    public required string Name { get; set; }

    /// <summary>
    /// The level of the hosted competitions it is, whose round takes a paper of this category when the paper's board
    /// is finalized; null for a category no hosted round runs.
    /// </summary>
    public HostedCompetitionCategory? HostedCategory { get; set; }
}
