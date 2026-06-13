using MathComps.Cli.Similarity.Dtos;

namespace MathComps.Cli.Similarity.Services;

/// <summary>
/// Service for retrieving problem data needed for similarity calculations.
/// </summary>
public interface IProblemDataService
{
    /// <summary>
    /// Retrieves basic problem metadata for batch processing operations.
    /// Returns lightweight DTOs containing only ID and slug information needed for iteration.
    /// Handles filtering internally to maintain clean separation of concerns.
    /// Supports skipping problems that already have similarity relationships to avoid redundant work.
    /// </summary>
    /// <param name="takeCount">Maximum number of problems to return in this batch.</param>
    /// <param name="skipAlreadyProcessedProblems">Whether to skip problems that already have similarity calculations stored.</param>
    /// <param name="cancellationToken">Token to cancel the operation if needed.</param>
    /// <returns>Collection of basic problem metadata for batch processing.</returns>
    Task<IReadOnlyList<ProblemMetadata>> GetProblemsForSimilarityCalculationAsync(
        int takeCount,
        bool skipAlreadyProcessedProblems,
        CancellationToken cancellationToken = default);

    /// <summary>
    /// Retrieves problem data required for similarity calculation operations.
    /// Returns essential problem information including embeddings, tags, and competition context
    /// packaged in a clean DTO format that doesn't expose database entities.
    /// </summary>
    /// <param name="problemId">Unique identifier of the problem to retrieve data for.</param>
    /// <param name="cancellationToken">Token to cancel the operation if needed.</param>
    /// <returns>Problem data DTO containing all information needed for similarity calculations.</returns>
    Task<ProblemSimilarityData> GetProblemSimilarityDataAsync(Guid problemId, CancellationToken cancellationToken = default);
}
