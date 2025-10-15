using System.ComponentModel.DataAnnotations;

namespace MathComps.Domain.EfCoreEntities;

/// <summary>
/// Represents a round that belongs to exactly one competition.
/// </summary>
public class Round
{
    /// <summary>
    /// Primary key.
    /// </summary>
    public Guid Id { get; set; } = Guid.CreateVersion7();

    /// <summary>
    /// Foreign key to the owning competition.
    /// </summary>
    public required Guid CompetitionId { get; set; }

    /// <summary>
    /// Navigation to the owning competition.
    /// </summary>
    public Competition Competition { get; set; } = null!;

    /// <summary>
    /// Foreign key to the problem's grade (age/level category). Null if grades are not used.
    /// </summary>
    public Guid? CategoryId { get; set; }

    /// <summary>
    /// Navigation to the problem's grade.
    /// </summary>
    public Category? Category { get; set; }

    /// <summary>
    /// Display name (e.g., "Krajské"). Empty if <see cref="IsDefault"/> is true.
    /// </summary>
    [MaxLength(50)]
    public required string DisplayName { get; set; }

    /// <summary>
    /// Full display name (e.g., "Krajské kolo"). Empty if <see cref="IsDefault"/> is true.
    /// </summary>
    [MaxLength(200)]
    public required string FullName { get; set; }

    /// <summary>
    /// URL-safe slug unique within the round (lowercase, hyphenated). Empty if <see cref="IsDefault"/> is true.
    /// </summary>
    [MaxLength(100)]
    public required string Slug { get; set; }

    /// <summary>
    /// The slug that combined the competition, category and round, for example csmo-a-iii (the national round) or 
    /// cpsj-i (the individual round of cpsj) or just imo (which has no category or subrounds).
    /// </summary>
    [MaxLength(100)]
    public required string CompositeSlug { get; set; }

    /// <summary>
    /// Sort order within the competition.
    /// </summary>
    [Range(1, int.MaxValue)]
    public required int SortOrder { get; set; }

    /// <summary>
    /// If true, this is the default round for a competition that has only one round.
    /// </summary>
    public bool IsDefault { get; set; }

    /// <summary>
    /// Round instances (combinations of this round with different seasons).
    /// </summary>
    public ICollection<RoundInstance> RoundInstances { get; } = [];
}
