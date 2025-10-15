using MathComps.Cli.Similarity.Dtos;
using MathComps.Cli.Similarity.Settings;
using Microsoft.Extensions.Options;
using Pgvector;
using System.Net.Http.Json;

namespace MathComps.Cli.Similarity.Services;

/// <summary>
/// Implementation of the embedding service that communicates with an external API.
/// Handles batch processing of texts and converts responses to pgvector Vector objects.
/// </summary>
/// <param name="httpClient">HTTP client for making requests to the embedding service.</param>
/// <param name="settings">Configuration settings for the embedding service connection.</param>
public class EmbeddingService(HttpClient httpClient, IOptions<EmbeddingServiceSettings> settings) : IEmbeddingService
{
    /// <inheritdoc/>
    public async Task<Vector[]> GenerateEmbeddingsAsync(
        string[] texts,
        string? role = null,
        CancellationToken cancellationToken = default)
    {
        // We need text
        if (texts.Length == 0)
            throw new ArgumentException("At least one text must be provided for embedding", nameof(texts));

        // Create the request payload with the texts and optional role indicator.
        var request = new EmbeddingRequest(texts, role);

        // Merge our token
        using var finalToken = CancellationTokenSource.CreateLinkedTokenSource(cancellationToken,
            // With a configured timeout
            new CancellationTokenSource(TimeSpan.FromSeconds(settings.Value.TimeoutSeconds)).Token
        );

        // Make the HTTP request to the embedding service.
        using var response = await httpClient.PostAsJsonAsync("/embed", request, finalToken.Token);

        // Ensure the request was successful.
        response.EnsureSuccessStatusCode();

        // Deserialize the response into our DTO.
        return [..((await response.Content.ReadFromJsonAsync<EmbeddingResponse>(cancellationToken))
            // Ensure it's okay
            ?? throw new InvalidOperationException("Received empty response from embedding service"))
            // Get PgVectors
            .Vectors.Select(vectorData => new Vector(vectorData.Select(number => (float)number).ToArray())),];
    }
}
