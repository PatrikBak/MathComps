using System.ComponentModel.DataAnnotations;

namespace MathComps.Domain.EfCoreEntities;

/// <summary>
/// One competition at whatever granularity it is named: a whole brand ("Slovenská MO", "IMO"), an age
/// category within one, a round within that, or anything nested further. Competitions form a tree of
/// unbounded depth, and one is addressed by <see cref="Path"/>, which is also the form a URL names it by.
/// </summary>
public class Competition
{
    /// <summary>
    /// Primary key.
    /// </summary>
    public Guid Id { get; set; } = Guid.CreateVersion7();

    /// <summary>
    /// Foreign key to the competition one level up. Null at a root, which is a whole brand.
    /// </summary>
    public Guid? ParentId { get; set; }

    /// <summary>
    /// Navigation to the competition one level up.
    /// </summary>
    public Competition? Parent { get; set; }

    /// <summary>
    /// URL-safe slug, unique among siblings (e.g. <c>csmo</c>, <c>a</c>, <c>iii</c>). Carries no hyphen,
    /// since a hyphen is what joins a slug to its parent's path.
    /// </summary>
    [MaxLength(100)]
    public required string Slug { get; set; }

    /// <summary>
    /// The slugs from the root down to this competition, hyphen-joined (e.g. <c>csmo-a-iii</c>, <c>imo</c>).
    /// </summary>
    [MaxLength(200)]
    public required string Path { get; set; }

    /// <summary>
    /// The sort orders from the root down to this competition, each zero-padded and dot-joined (e.g.
    /// <c>0001.0001.0004</c>), so one string comparison orders the whole tree at any depth.
    /// </summary>
    [MaxLength(200)]
    public required string SortPath { get; set; }

    /// <summary>
    /// Editorial sort order among siblings, 1-based.
    /// </summary>
    [Range(1, int.MaxValue)]
    public required int SortOrder { get; set; }

    /// <summary>
    /// The competitions one level below, empty at a leaf.
    /// </summary>
    public ICollection<Competition> Children { get; } = [];

    /// <summary>
    /// Rounds that belong exclusively to this competition.
    /// </summary>
    public ICollection<Round> Rounds { get; } = [];
}
