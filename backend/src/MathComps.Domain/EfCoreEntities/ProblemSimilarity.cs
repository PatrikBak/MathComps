namespace MathComps.Domain.EfCoreEntities;

/// <summary>
/// Similarity link between problems.
/// Design: treat similarity as symmetric at the application level, and store
/// both directions for faster lookup (i.e., A→B and B→A), while keeping each
/// direction unique.
/// </summary>
public class ProblemSimilarity
{
    /// <summary>
    /// Foreign key to the source problem.
    /// </summary>
    public Guid SourceProblemId { get; set; }

    /// <summary>
    /// Navigation to the source problem.
    /// </summary>
    public Problem SourceProblem { get; set; } = null!;

    /// <summary>
    /// Foreign key to the similar problem.
    /// </summary>
    public Guid SimilarProblemId { get; set; }

    /// <summary>
    /// Navigation to the similar problem.
    /// </summary>
    public Problem SimilarProblem { get; set; } = null!;

    /// <summary>
    /// Similarity score; scale is application-defined (higher usually means more similar).
    /// </summary>
    public required double SimilarityScore { get; set; }

    /// <summary>
    /// Detailed breakdown of similarity components automatically serialized as JSON by EF Core.
    /// Contains individual scores for statement, solution, tag, and competition similarities
    /// that contributed to the final similarity score, enabling algorithm transparency and analysis.
    /// </summary>
    public SimilarityComponents? Components { get; set; }
}
