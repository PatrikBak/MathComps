using Pgvector;

namespace MathComps.Cli.Similarity.Services;

/// <summary>
/// Service for generating vector embeddings from any text.
/// </summary>
public interface IEmbeddingService
{
    /// <summary>
    /// Generates vector embeddings for the provided text samples.
    /// </summary>
    /// <param name="texts">Text samples to embed (problem statements or solutions).</param>
    /// <param name="role">Role indicator for the embedding model ("passage" for documents, "query" for searches).</param>
    /// <param name="cancellationToken">Token to cancel the operation.</param>
    /// <returns>Array of vector embeddings corresponding to the input texts.</returns>
    Task<Vector[]> GenerateEmbeddingsAsync(string[] texts, string? role = null, CancellationToken cancellationToken = default);
}
