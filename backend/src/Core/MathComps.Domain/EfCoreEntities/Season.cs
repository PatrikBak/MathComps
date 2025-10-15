using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace MathComps.Domain.EfCoreEntities;

/// <summary>
/// Universal, competition-agnostic academic season (e.g., 2024/2025).
/// In the CZ/SK context, a season also carries a shared "ročník" label
/// used to group all competitions that occur within that season.
/// </summary>
public class Season
{
    /// <summary>
    /// Primary key.
    /// </summary>
    public Guid Id { get; set; } = Guid.CreateVersion7();

    /// <summary>
    /// Season start year (e.g., 2024 for the 2024/2025 season).
    /// </summary>
    public required int StartYear { get; set; }

    /// <summary>
    /// Season end year (computed as StartYear + 1).
    /// </summary>
    [NotMapped]
    public int EndYear => StartYear + 1;

    /// <summary>
    /// Season-wide label used for CZ/SK "ročník" grouping across competitions
    /// (e.g., "75. ročník").
    /// </summary>
    [MaxLength(100)]
    public required string EditionLabel { get; set; }

    /// <summary>
    /// Numeric edition for easier numeric filtering (e.g., 75).
    /// </summary>
    public required int EditionNumber { get; set; }

    /// <summary>
    /// Display name of the season (e.g., "2024/2025").
    /// </summary>
    [NotMapped]
    public string Name => $"{StartYear}/{StartYear + 1}";

    /// <summary>
    /// Round instances that occur in this season.
    /// </summary>
    public ICollection<RoundInstance> RoundInstances { get; } = [];
}
