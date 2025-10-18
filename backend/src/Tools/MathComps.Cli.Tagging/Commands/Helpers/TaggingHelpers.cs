using MathComps.Cli.Tagging.Dtos;
using System.Collections.Immutable;
using System.Text.Json;

namespace MathComps.Cli.Tagging.Commands.Helpers;

/// <summary>
/// Commons helpers to parse AI response for tagging, which is common for both suggesting tags
/// and actual problem tagging.
/// </summary>
public static class TaggingHelpers
{
    /// <summary>
    /// Parses a raw assistant response produced by the tagging tools into a structured <see cref="SimpleTagsByCategory"/>.
    /// Cleans markdown code fences. Doesn't catch exceptions.
    /// </summary>
    /// <param name="response">Raw text returned by the assistant. May include markdown fences (``` or ```json</param>
    /// <returns>A <see cref="SimpleTagsByCategory"/> when parsing succeeds</returns>
    public static SimpleTagsByCategory ParseSuggestedTags(string response)
    {
        // Clean up AI response - remove markdown code blocks if present.
        var cleanedResponse = CleanJsonResponse(response);

        // Attempt to parse the JSON response to validate format and count suggestions.
        return JsonSerializer.Deserialize<SimpleTagsByCategory>(cleanedResponse)
            // Ensure it doesn't parse to null
            ?? throw new Exception("AI response parsed to null") { Data = { ["AiResponse"] = response } };
    }

    /// <summary>
    /// Parses a raw assistant response containing tag approval decisions into a structured dictionary.
    /// Cleans markdown code fences. Doesn't catch exceptions.
    /// </summary>
    /// <param name="response">Raw text returned by the assistant. May include markdown fences (``` or ```json</param>
    /// <returns>A dictionary mapping tag names to approval decisions when parsing succeeds</returns>
    public static ImmutableDictionary<string, TagApprovalDecision> ParseTagApprovals(string response)
    {
        // Clean up AI response - remove markdown code blocks if present
        var cleanedResponse = CleanJsonResponse(response);

        // Attempt to parse the JSON response to validate format and extract approval decisions
        return JsonSerializer.Deserialize<ImmutableDictionary<string, TagApprovalDecision>>(cleanedResponse)
            // Ensure it doesn't parse to null
            ?? throw new Exception("AI response parsed to null") { Data = { ["AiResponse"] = response } };
    }

    /// <summary>
    /// Parses a raw assistant response containing tag fitness scores into a structured dictionary.
    /// Cleans markdown code fences. Doesn't catch exceptions.
    /// </summary>
    /// <param name="response">Raw text returned by the assistant. May include markdown fences (``` or ```json</param>
    /// <returns>A dictionary mapping tag names to fitness scores when parsing succeeds</returns>
    public static ImmutableDictionary<string, TagFitness> ParseTagFitnesses(string response)
    {
        // Clean up AI response - remove markdown code blocks if present
        var cleanedResponse = CleanJsonResponse(response);

        // Attempt to parse the JSON response to validate format and extract fitness scores
        return JsonSerializer.Deserialize<ImmutableDictionary<string, TagFitness>>(cleanedResponse)
            // Ensure it doesn't parse to null
            ?? throw new Exception("AI response parsed to null") { Data = { ["AiResponse"] = response } };
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
