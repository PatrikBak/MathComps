using System.ComponentModel.DataAnnotations;

namespace MathComps.Domain.EfCoreEntities;

/// <summary>
/// Represents a competition brand (e.g., "Slovenská MO", "IMO").
/// </summary>
public class Competition
{
    /// <summary>
    /// Primary key.
    /// </summary>
    public Guid Id { get; set; } = Guid.CreateVersion7();

    /// <summary>
    /// Display name (e.g., "IMO", "CSMO").
    /// </summary>
    [MaxLength(50)]
    public required string DisplayName { get; set; }

    /// <summary>
    /// Full display name (e.g., "International Mathematical Olympiad").
    /// </summary>
    [MaxLength(200)]
    public required string FullName { get; set; }

    /// <summary>
    /// URL-safe unique slug (lowercase, hyphenated).
    /// </summary>
    [MaxLength(100)]
    public required string Slug { get; set; }

    /// <summary>
    /// Editorial sort order across competitions (positive integer).
    /// </summary>
    [Range(1, int.MaxValue)]
    public required int SortOrder { get; set; }

    /// <summary>
    /// Rounds that belong exclusively to this competition.
    /// </summary>
    public ICollection<Round> Rounds { get; } = [];

}
