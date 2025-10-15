using System.ComponentModel.DataAnnotations;

namespace MathComps.Domain.EfCoreEntities;

/// <summary>
/// Student age grade (CZ/SK olympiad “category”), e.g., "A", "B", "C".
/// Represents the level/age bracket a problem targets.
/// </summary>
public class Category
{
    /// <summary>
    /// Primary key.
    /// </summary>
    public Guid Id { get; set; } = Guid.CreateVersion7();

    /// <summary>
    /// Display name (e.g., "A").
    /// </summary>
    [MaxLength(100)]
    public required string Name { get; set; }

    /// <summary>
    /// URL-safe unique slug (lowercase, hyphenated).
    /// </summary>
    [MaxLength(100)]
    public required string Slug { get; set; }

    /// <summary>
    /// Sort order for display purposes. Z{n} categories ordered by n, then A, B, C.
    /// </summary>
    [Range(1, int.MaxValue)]
    public required int SortOrder { get; set; }

    /// <summary>
    /// Problems assigned to this grade.
    /// </summary>
    public ICollection<Problem> Problems { get; } = [];

    /// <summary>
    /// Rounds assigned to this grade.
    /// </summary>
    public ICollection<Round> Rounds { get; } = [];
}
