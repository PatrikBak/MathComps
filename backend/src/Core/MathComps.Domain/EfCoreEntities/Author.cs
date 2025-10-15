using System.ComponentModel.DataAnnotations;

namespace MathComps.Domain.EfCoreEntities;

/// <summary>
/// Represents an author of a problem.
/// </summary>
public class Author
{
    /// <summary>
    /// Primary key.
    /// </summary>
    public Guid Id { get; set; } = Guid.CreateVersion7();

    /// <summary>
    /// Display name of the author.
    /// </summary>
    [MaxLength(100)]
    public required string Name { get; set; }

    /// <summary>
    /// URL-safe unique slug (lowercase, hyphenated).
    /// </summary>
    [MaxLength(100)]
    public required string Slug { get; set; }

    /// <summary>
    /// Problems authored by this person via the ordered join entity.
    /// </summary>
    public ICollection<ProblemAuthor> ProblemAuthors { get; } = [];
}
