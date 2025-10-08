using MathComps.Cli.Tagging.Settings;
using Microsoft.Extensions.Options;
using System.Text;
using System.Text.Json;
using System.Text.Json.Nodes;

namespace MathComps.Cli.Tagging.Services;

/// <summary>
/// A service to interact with the Google Gemini API using HttpClient.
/// </summary>
/// <param name="httpClient">The HttpClient for making API requests.</param>
/// <param name="geminiSettings">The configuration settings for the Gemini API.</param>
public class GeminiService(HttpClient httpClient, IOptions<GeminiSettings> geminiSettings) : IGeminiService
{
    /// <summary>
    /// Reusable JsonSerializer options with camelCase naming policy.
    /// </summary>
    private static readonly JsonSerializerOptions _jsonSerializerOptions = new()
    {
        PropertyNamingPolicy = JsonNamingPolicy.CamelCase,
    };

    /// <inheritdoc />
    public async Task<string> GenerateContentAsync(string model, string systemPrompt, string userPrompt, int thinkingBudget, CancellationToken cancellationToken = default)
    {
        // The API key is essential for authenticating with the Gemini API.
        var apiKey = geminiSettings.Value.ApiKey;

        // It needs to be there
        if (string.IsNullOrWhiteSpace(apiKey))
            throw new InvalidOperationException("Gemini API key is not configured. Please set it in user secrets.");

        // The request URL is constructed with the model endpoint. 
        var url = $"https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent?key={apiKey}";

        // The payload includes a system instruction to define the AI's role and the user's content (the actual prompt).
        var payload = new
        {
            SystemInstruction = new
            {
                Parts = new[] { new { Text = systemPrompt } }
            },
            Contents = new[]
            {
                new { Parts = new[] { new { Text = userPrompt } } }
            },
            GenerationConfig = new
            {
                ThinkingConfig = new { ThinkingBudget = thinkingBudget }
            }
        };

        // The payload is serialized to JSON and sent as the body of the POST request.
        var jsonPayload = JsonSerializer.Serialize(payload, _jsonSerializerOptions);
        using var content = new StringContent(jsonPayload, Encoding.UTF8, "application/json");

        // The request is sent to the Gemini API...
        var response = await httpClient.PostAsync(url, content, cancellationToken);

        // This will throw an HttpRequestException for non-success status codes (e.g., 4xx, 5xx).
        response.EnsureSuccessStatusCode();

        // The raw JSON response body is read from the HTTP response.
        var responseBody = await response.Content.ReadAsStringAsync(cancellationToken);

        // The response JSON is parsed to extract the generated text content.
        // We navigate through the JSON structure to find the model's text response.
        var json = JsonNode.Parse(responseBody);
        var text = json?["candidates"]?[0]?["content"]?["parts"]?[0]?["text"]?.GetValue<string>();

        // If the expected text content is not found, it indicates an unexpected API response format.
        return text ?? throw new InvalidOperationException("Failed to parse the response from the Gemini API. The response format may have changed.");
    }
}
