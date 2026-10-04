using System.ComponentModel.DataAnnotations;

namespace MathComps.Domain.EfCoreEntities;

/// <summary>
/// One board of the selection: a named set of papers whose slots are filled from the proposals. A board touches
/// real rounds only when it is finalized into a hosted group, and until then it is a draft nothing outside the
/// selection reads.
/// </summary>
public class SelectionBoard
{
    /// <summary>
    /// Primary key (Guid v7).
    /// </summary>
    public Guid Id { get; set; } = Guid.CreateVersion7();

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
    /// FK to the hosted group the board was finalized into, or null while it is a draft. Once set, the board's
    /// slots are the group's rounds.
    /// </summary>
    public Guid? HostedGroupId { get; set; }

    /// <summary>
    /// Navigation to the hosted group, null on a draft.
    /// </summary>
    public HostedGroup? HostedGroup { get; set; }

    /// <summary>
    /// Its papers.
    /// </summary>
    public ICollection<SelectionPaper> Papers { get; } = [];
}
