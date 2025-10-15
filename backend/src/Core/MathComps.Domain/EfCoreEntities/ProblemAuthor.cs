using System.ComponentModel.DataAnnotations;

namespace MathComps.Domain.EfCoreEntities;

/// <summary>
/// Join entity between Problem and Author that preserves author order.
/// </summary>
public class ProblemAuthor
{
    /// <summary>
    /// Foreign key to the problem.
    /// </summary>
    public required Guid ProblemId { get; set; }

    /// <summary>
    /// Navigation to the problem.
    /// </summary>
    public Problem Problem { get; set; } = null!;

    /// <summary>
    /// Foreign key to the author.
    /// </summary>
    public required Guid AuthorId { get; set; }

    /// <summary>
    /// Navigation to the author.
    /// </summary>
    public Author Author { get; set; } = null!;

    /// <summary>
    /// 1-based order of this author on the problem.
    /// </summary>
    [Range(1, int.MaxValue)]
    public required int Ordinal { get; set; }
}
