using System.Collections.Immutable;
using System.Text.Json.Serialization;

namespace MathComps.Cli.Tagging.Dtos;

/// <summary>
/// Represents the AI's response for tagging a single problem organized by category.
/// Used to deserialize JSON responses from the tag-problems command.
/// </summary>
/// <param name="Area">Area tags assigned to the problem (mathematical fields). May be null if AI returns incomplete JSON.</param>
/// <param name="Type">Type tags assigned to the problem (problem structures and objects). May be null if AI returns incomplete JSON.</param>
/// <param name="Technique">Technique tags assigned to the problem (solution methods). May be null if AI returns incomplete JSON.</param>
public record TagCollection(
    [property: JsonPropertyName("area")] string[]? Area,
    [property: JsonPropertyName("type")] string[]? Type,
    [property: JsonPropertyName("technique")] string[]? Technique)
{
    /// <summary>
    /// Combines all categorized tags into a single immutable list of tag names.
    /// Handles null categories gracefully when AI returns incomplete JSON responses.
    /// The result is sorted and deduplicated for consistent database operations.
    /// </summary>
    /// <returns>An <see cref="ImmutableList{T}"/> containing all suggested tag names from all categories.</returns>
    public ImmutableList<string> GetAllTags()
        // Return sorted, deduplicated results
        => [.. new List<string>([.. Area ?? [], .. Type ?? [], .. Technique ?? []]).Distinct().Order()];
}
