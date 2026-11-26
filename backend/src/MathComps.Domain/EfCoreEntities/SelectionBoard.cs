using System.ComponentModel.DataAnnotations;

namespace MathComps.Domain.EfCoreEntities;

/// <summary>
/// One board of the selection: a named set of papers whose slots are filled from the proposals, picked for one
/// hosted group or for none. A board touches real rounds only when it is finalized into its group, and until then
/// it is a draft nothing outside the selection reads.
/// </summary>
public class SelectionBoard
{
    /// <summary>
    /// Primary key (Guid v7).
    /// </summary>
    public Guid Id { get; set; } = Guid.CreateVersion7();

    /// <summary>
    /// FK to the organization picking its papers.
    /// </summary>
    public required Guid OrganizationId { get; set; }

    /// <summary>
    /// Navigation to the organization.
    /// </summary>
    public Organization Organization { get; set; } = null!;

    /// <summary>
    /// What the board is called.
    /// </summary>
    [MaxLength(200)]
    public required string Name { get; set; }

    /// <summary>
    /// When the board was made.
    /// </summary>
    public required DateTimeOffset CreatedAt { get; set; }

    /// <summary>
    /// FK to the hosted group the board picks papers for, or null for a board picking for no group, which never
    /// finalizes.
    /// </summary>
    public Guid? HostedGroupId { get; set; }

    /// <summary>
    /// Navigation to the hosted group, null on a board picking for no group.
    /// </summary>
    public HostedGroup? HostedGroup { get; set; }

    /// <summary>
    /// Whether the board has been finalized into its group. From then on its slots are the group's rounds.
    /// </summary>
    public bool IsFinalized { get; set; }

    /// <summary>
    /// Its papers.
    /// </summary>
    public ICollection<SelectionPaper> Papers { get; } = [];
}
