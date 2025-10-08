using System.Collections.Immutable;
using System.Text.Json;
using MathComps.Cli.Tagging.Dtos;

namespace MathComps.Cli.Tagging.Services;

/// <summary>
/// Static methods for loading tag-related files with support for categorized tag vocabulary.
/// </summary>
public static class TagFilesHelper
{
    /// <summary>
    /// The folder with the tag files, pointing to the committed folder Data under the project.
    /// </summary>
    public const string DataFolder = "Data";

    /// <summary>
    /// Read categorized approved tags with their types from the section-based format.
    /// Returns tuples of (Name, TagType) for complete tag information.
    /// </summary>
    /// <remarks>The tags with their type</remarks>
    public static TagsByCategory GetCategorizedApprovedTags()
    {
        var jsonContent = File.ReadAllText(Path.Combine(DataFolder, "approved-tags.json"));
        return JsonSerializer.Deserialize<TagsByCategory>(jsonContent) ?? throw new InvalidOperationException("Could not parse json");
    }

    public static ImmutableDictionary<string, string> GetForbiddenTags()
    {
        var text = File.ReadAllText(Path.Combine(DataFolder, "forbidden-tags.json"));
        return JsonSerializer.Deserialize<ImmutableDictionary<string, string>>(text)
            ?? throw new Exception("Couldn't parse forbidden tags");
    }

    /// <summary>
    /// Write AI's categorized tag suggestions in the same format as approved-tags.json for easy manual merging.
    /// </summary>
    /// <param name="suggestedTagsJson">The JSON response from the AI containing categorized tag suggestions.</param>
    /// <param name="tags">Already parsed and deduplicated tags</param>
    /// <param name="problems">The slugs of problems it used to infer the tags, written for debugging purposes.</param>
    public static void WriteTags(string suggestedTagsJson, SimpleTagsByCategory? tags, ImmutableList<string> problems)
    {
        var datetime = DateTime.Now;

        {
            var output = new List<string>
            {
                "AI-Suggested Tags",
                $"Generated: {datetime:yyyy-MM-dd HH:mm:ss}",
                $"Based on {problems.Count} problems",
                "",
                "Original AI Response (for debugging):",
                $"{suggestedTagsJson}",
                "Problems analyzed:"
            };
            output.AddRange(problems);

            var path = Path.Combine(DataFolder, "SuggestedTags", $"{datetime:yyyy-MM-dd_HH-mm-ss}.txt");
            Directory.CreateDirectory(Path.GetDirectoryName(path)!);
            File.WriteAllLines(path, output);
        }

        if (tags != null)
        {
            var path = Path.Combine(DataFolder, "SuggestedTags", $"{datetime:yyyy-MM-dd_HH-mm-ss}.json");
            File.WriteAllText(path, tags.ToJson());
        }
    }
}
