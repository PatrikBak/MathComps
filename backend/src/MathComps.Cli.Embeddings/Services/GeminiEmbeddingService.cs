using MathComps.Infrastructure.Options;
using Microsoft.Extensions.Options;
using System.Text;
using System.Text.Json.Nodes;
using MathComps.Shared.Serialization;

namespace MathComps.Cli.Embeddings.Services;

/// <summary>
/// A service to generate embeddings using the Google Gemini API.
/// </summary>
/// <param name="httpClient">The HttpClient for making API requests.</param>
/// <param name="geminiSettings">The configuration settings for the Gemini API.</param>
public class GeminiEmbeddingService(HttpClient httpClient, IOptions<GeminiSettings> geminiSettings) : IGeminiEmbeddingService
{
    /// <inheritdoc />
    public async Task<float[][]> GenerateEmbeddingsAsync(string model, string[] texts, string taskType, int? outputDimensionality = null)
    {
        // The API key is essential for authenticating with the Gemini API.
        var apiKey = geminiSettings.Value.ApiKey;

        // It needs to be there
        if (string.IsNullOrWhiteSpace(apiKey))
            throw new InvalidOperationException("Gemini API key is not configured. Please set it in user secrets.");

        // The request URL is constructed with the model endpoint for batch embedding.
        var url = $"https://generativelanguage.googleapis.com/v1beta/models/{model}:batchEmbedContents?key={apiKey}";

        // Prepare the request data in the structure expected by the Gemini API.
        var payload = new
        {
            Requests = texts.Select(text => new
            {
                Model = $"models/{model}",
                TaskType = taskType,
                OutputDimensionality = outputDimensionality,
                Content = new
                {
                    Parts = new[] { new { Text = text } }
                }
            })
        };

        // The payload is serialized to JSON and sent as the body of the POST request.
        using var content = new StringContent(payload.ToJson(), Encoding.UTF8, "application/json");

        // The request is sent to the Gemini API...
        var response = await httpClient.PostAsync(url, content);

        // This will throw an HttpRequestException for non-success status codes (e.g., 4xx, 5xx).
        response.EnsureSuccessStatusCode();

        // The raw JSON response body is read from the HTTP response.
        var responseBody = await response.Content.ReadAsStringAsync();

        // Parse the response JSON to extract the embeddings.
        var embeddings = JsonNode.Parse(responseBody)?["embeddings"]?.AsArray()
            ?? throw new InvalidOperationException("Failed to parse embeddings from the Gemini API response.");

        // Ensure count matches
        if (embeddings.Count != texts.Length)
            throw new InvalidOperationException("Count mismatch between input texts and embeddings.");

        // From each embedding
        return [.. embeddings
            // Extract...
            .Select((embedding, index)
                // The vector values
                => (embedding?["values"]?.AsArray()
                    // Ensure they're there
                    ?? throw new InvalidOperationException($"Failed to extract embedding values for text at index {index}."))
                    // Each vector array
                    .Select(value => 
                        // Should have correct floats
                        value?.GetValue<float>() 
                            // Ensure it's the case
                            ?? throw new InvalidOperationException($"Null value encountered in embedding at position {index}"))
                    // Get the problem embedding
                    .ToArray())];
    }
}
