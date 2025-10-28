namespace MathComps.Cli.Embeddings.Services;

/// <summary>
/// Defines the contract for a service that generates embeddings using the Gemini API.
/// </summary>
public interface IGeminiEmbeddingService
{
    /// <summary>
    /// Generates embeddings for the provided texts using the Gemini API.
    /// </summary>
    /// <param name="model">The model to use for embedding generation.</param>
    /// <param name="texts">The texts to embed.</param>
    /// <param name="taskType">The task type for the embedding accoding to the API doc.</param>
    /// <param name="outputDimensionality">Desired dimensionality of the output vectors. If null, the Gemini's default is used.</param>
    /// <returns>Array of vector embeddings corresponding to the input texts.</returns>
    Task<float[][]> GenerateEmbeddingsAsync(string model, string[] texts, string taskType, int? outputDimensionality = null);
}
