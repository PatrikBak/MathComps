using MathComps.Cli.Tagging.Dtos;
using System.Text.Json;

namespace MathComps.Cli.Tagging.Commands;

/// <summary>
/// Commons helpers to parse AI response for tagging, which is common for both suggesting tags
/// and actual problem tagging.
/// </summary>
public static class TaggingHelpers
{
    /// <summary>
    /// Parses a raw assistant response produced by the tagging tools into a structured <see cref="TagCollection"/>.
    /// Cleans markdown code fences, handles the sentinel "NONE", and deserializes JSON.
    /// Throws when the response cannot be parsed into the expected shape.
    /// </summary>
    /// <param name="response">
    /// Raw text returned by the assistant. May include markdown fences (``` or ```json), whitespace,
    /// or the sentinel "NONE" when no tags are suggested.
    /// </param>
    /// <returns>
    /// A <see cref="TagCollection"/> when parsing succeeds; an empty <see cref="TagCollection"/> when the response is "NONE".
    /// </returns>
    public static TagCollection? ParseAiResponse(string response)
    {
        // No tags
        if (response.Trim().ToUpperInvariant() is "NONE")
            return new([], [], []);

        // Clean up AI response - remove markdown code blocks if present.
        var aiResponseJson = CleanJsonResponse(response);

        // Attempt to parse the JSON response to validate format and count suggestions.
        return JsonSerializer.Deserialize<TagCollection>(aiResponseJson)
            // Forbid null
            ?? throw new Exception("AI response parsed to null");
    }

    /// <summary>
    /// Cleans AI response by removing markdown code block markers that interfere with JSON parsing.
    /// </summary>
    /// <param name="aiResponse">Raw AI response that may contain markdown formatting.</param>
    /// <returns>Clean JSON string ready for parsing.</returns>
    private static string CleanJsonResponse(string aiResponse)
    {
        // Ensure we have something to clean
        if (string.IsNullOrWhiteSpace(aiResponse))
            return aiResponse;

        // Trimmed first
        var trimmed = aiResponse.Trim();

        // Kill the json marker start
        if (trimmed.StartsWith("```json"))
            trimmed = trimmed[7..].TrimStart();

        // Kill markdown start
        else if (trimmed.StartsWith("```"))
            trimmed = trimmed[3..].TrimStart();

        // Remove closing markdown markers
        if (trimmed.EndsWith("```"))
            trimmed = trimmed[..^3].TrimEnd();

        // Trim again
        return trimmed.Trim();
    }
}
