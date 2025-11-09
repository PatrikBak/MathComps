using MathComps.Infrastructure.Options;
using MathComps.Shared;
using Microsoft.Extensions.Options;
using System.Text;
using System.Text.Json.Nodes;

namespace MathComps.Infrastructure.Services;

/// <summary>
/// A service to interact with the Google Gemini API using HttpClient.
/// </summary>
/// <param name="httpClient">The HttpClient for making API requests.</param>
/// <param name="geminiSettings">The configuration settings for the Gemini API.</param>
public class GeminiService(HttpClient httpClient, IOptions<GeminiSettings> geminiSettings) : IGeminiService
{
    /// <inheritdoc />
    public async Task<string> GenerateContentAsync(string model, string systemPrompt, string userPrompt, int thinkingBudget, CancellationToken cancellationToken = default)
    {
        // The API key is essential for authenticating with the Gemini API.
        var apiKey = geminiSettings.Value.ApiKey;

        // It needs to be there
        if (string.IsNullOrWhiteSpace(apiKey))
            throw new InvalidOperationException("Gemini API key is not configured. Please set it in user secrets.");

        // Create a timeout cancellation token that combines with the provided one
        using var timeoutCts = new CancellationTokenSource(TimeSpan.FromSeconds(geminiSettings.Value.TimeoutSeconds));
        using var combinedCts = CancellationTokenSource.CreateLinkedTokenSource(cancellationToken, timeoutCts.Token);

        // The request URL is constructed with the model endpoint. 
        var url = $"https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent?key={apiKey}";

        // Prepare the request data in the structure expected by the Gemini API.
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
        using var content = new StringContent(payload.ToJson(), Encoding.UTF8, "application/json");

        // The request is sent to the Gemini API...
        var response = await httpClient.PostAsync(url, content, combinedCts.Token);

        // Read the content
        var body = await response.Content.ReadAsStringAsync(combinedCts.Token);

        // Handle if API didn't return 400
        if (!response.IsSuccessStatusCode)
            throw new HttpRequestException($"Gemini API error {response.StatusCode}: {body}");

        // The response JSON is parsed to extract the generated text content.
        // We navigate through the JSON structure to find the model's text response.
        var json = JsonNode.Parse(body);
        var text = json?["candidates"]?[0]?["content"]?["parts"]?[0]?["text"]?.GetValue<string>();

        // If the expected text content is not found, it indicates an unexpected API response format.
        return text ?? throw new InvalidOperationException("Failed to parse the response from the Gemini API. The response format may have changed.");
    }
}
