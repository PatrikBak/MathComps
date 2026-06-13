using MathComps.Cli.Similarity.Dtos;

namespace MathComps.Cli.Similarity.Services;

/// <summary>
/// Unified service responsible for calculating comprehensive similarity scores for math problems.
/// Orchestrates the entire similarity calculation pipeline from candidate identification through
/// final scoring using multiple complementary strategies. This service combines structured metadata
/// (tags, competitions) with semantic understanding (embeddings) to produce robust similarity rankings.
/// </summary>
public interface IProblemSimilarityService
{
    /// <summary>
    /// Calculates comprehensive similarity scores for a source problem against all eligible candidates.
    /// </summary>
    /// <param name="sourceProblemData">Complete source problem data including embeddings, tags, and competition context.</param>
    /// <param name="cancellationToken">Cancellation mechanism for long-running database operations.</param>
    /// <returns>Similarity results ordered by descending similarity score, providing transparent scoring breakdown.</returns>
    Task<IReadOnlyList<SimilarityResult>> CalculateProblemSimilaritiesAsync(
        ProblemSimilarityData sourceProblemData,
        CancellationToken cancellationToken = default);
}
