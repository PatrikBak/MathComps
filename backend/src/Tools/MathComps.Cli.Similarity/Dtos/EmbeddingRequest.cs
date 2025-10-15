namespace MathComps.Cli.Similarity.Dtos;

/// <summary>
/// Request payload for the external embedding service API.
/// Encapsulates text content that needs to be transformed into semantic vector representations
/// for similarity calculation. Supports batch processing for efficiency and includes role hints
/// to optimize embedding quality based on the intended use case.
/// </summary>
/// <param name="Texts">Array of text samples to be converted into vector embeddings.param>
/// <param name="Role">Optional role indicator that helps the embedding model optimize vector generation. 
/// Use "passage" for document content like problem statements, "query" for search terms.</param>
public record EmbeddingRequest(string[] Texts, string? Role);
