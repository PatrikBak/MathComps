namespace MathComps.Cli.Similarity.Dtos;

/// <summary>
/// Response payload from the external embedding service API.
/// Contains the generated vector representations that correspond to the input text samples.
/// Vectors are returned in the same order as the input texts to maintain correspondence
/// for batch processing workflows.
/// </summary>
/// <param name="Vectors">Array of vector embeddings corresponding to the input text samples. 
/// Each inner array represents a single text as floating-point values in high-dimensional semantic space. 
/// Order matches the input text order.</param>
public record EmbeddingResponse(double[][] Vectors);
