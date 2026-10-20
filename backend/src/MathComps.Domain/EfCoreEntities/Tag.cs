using System.ComponentModel.DataAnnotations;
using MathComps.Domain.Tagging;

namespace MathComps.Domain.EfCoreEntities;

/// <summary>
/// Categorized tag for mathematical problems, filed under one <see cref="Tagging.TagType"/>.
/// </summary>
public class Tag
{
    /// <summary>
    /// Primary key.
    /// </summary>
    public Guid Id { get; set; } = Guid.CreateVersion7();



    /// <summary>
    /// URL-safe unique slug (lowercase, hyphenated).
    /// </summary>
    [MaxLength(100)]
    public required string Slug { get; set; }

    /// <summary>
    /// Classification of tag by conceptual role.
    /// This categorization enables structured AI prompting and organized user filtering experience.
    /// </summary>
    public required TagType TagType { get; set; }

    /// <summary>
    /// Problems associated with this tag.
    /// </summary>
    public ICollection<ProblemTag> ProblemTagsAll { get; } = [];
}
