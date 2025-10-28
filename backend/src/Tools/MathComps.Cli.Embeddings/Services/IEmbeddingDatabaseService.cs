using MathComps.Cli.Embeddings.Dtos;

namespace MathComps.Cli.Embeddings.Services;

/// <summary>
/// Defines the contract for database operations related to embeddings.
/// </summary>
public interface IEmbeddingDatabaseService
{
    /// <summary>
    /// Gets problems that need embeddings generated.
    /// </summary>
    /// <param name="limit">Maximum number of problems to return.</param>
    /// <param name="forceRegenerate">If true, returns all problems regardless of existing embeddings.</param>
    /// <returns>List of problems that need embeddings.</returns>
    Task<List<ProblemForEmbeddingDto>> GetProblemsNeedingEmbeddingsAsync(int limit, bool forceRegenerate);

    /// <summary>
    /// Saves or updates embeddings for a problem.
    /// </summary>
    /// <param name="problemId">The problem ID.</param>
    /// <param name="embeddings">The embeddings to save.</param>
    Task SaveEmbeddingsAsync(Guid problemId, IReadOnlyCollection<ProblemEmbeddingUpsertDto> embeddings);
}
