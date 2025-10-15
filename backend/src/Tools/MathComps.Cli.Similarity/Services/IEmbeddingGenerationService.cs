namespace MathComps.Cli.Similarity.Services;

/// <summary>
/// Service for generating vector embeddings for math problems.
/// Ensures problems have the necessary embedding vectors for similarity calculation.
/// Handles all database operations internally to maintain clean separation of concerns.
/// </summary>
public interface IEmbeddingGenerationService
{
    /// <summary>
    /// Generates embeddings for a single problem, with option to force regeneration.
    /// Loads the problem, generates embeddings through external service, and persists changes.
    /// This method handles all database operations internally and provides clean ID-based interface.
    /// </summary>
    /// <param name="problemId">Unique identifier of the problem to process for embedding generation.</param>
    /// <param name="forceRegenerate">If true, regenerates embeddings even if they already exist. If false, only generates missing embeddings.</param>
    /// <param name="cancellationToken">Token to cancel the operation if needed.</param>
    Task EnsureDbProblemHasGeneratedEmbeddings(Guid problemId, bool forceRegenerate = false, CancellationToken cancellationToken = default);
}
