using System.ComponentModel.DataAnnotations;

namespace MathComps.Domain.EfCoreEntities;

/// <summary>
/// Categorized tag for mathematical problems supporting precise filtering by Area, Type, or Technique.
/// Each tag belongs to exactly one category.
/// </summary>
public class Tag
{
    /// <summary>
    /// Primary key.
    /// </summary>
    public Guid Id { get; set; } = Guid.CreateVersion7();

    /// <summary>
    /// Human-readable tag name.
    /// </summary>
    [MaxLength(100)]
    public required string Name { get; set; }

    /// <summary>
    /// URL-safe unique slug (lowercase, hyphenated).
    /// </summary>
    [MaxLength(100)]
    public required string Slug { get; set; }

    /// <summary>
    /// Classification of tag by conceptual role: Area (mathematical field), Type (problem structure), or Technique (solution method).
    /// This categorization enables structured AI prompting and organized user filtering experience.
    /// </summary>
    public required TagType TagType { get; set; }

    /// <summary>
    /// Problems associated with this tag.
    /// </summary>
    public ICollection<Problem> Problems { get; } = [];
}
