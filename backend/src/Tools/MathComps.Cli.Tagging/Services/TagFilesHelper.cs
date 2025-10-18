using MathComps.Cli.Tagging.Dtos;
using System.Text.Json;

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
        // Read the approved tags JSON file
        var jsonContent = File.ReadAllText(Path.Combine(DataFolder, "approved-tags.json"));

        // Deserialize into a custom structure
        return JsonSerializer.Deserialize<TagsByCategory>(jsonContent)
            // Just in case, the file should be valid
            ?? throw new InvalidOperationException("Approved tags parsed to null");
    }

    /// <summary>
    /// Read forbidden tags with their reasons from the JSON file.
    /// Returns a <see cref="TagDescriptions"/> record containing tag names mapped to their forbidden reasons.
    /// </summary>
    /// <returns>A <see cref="TagDescriptions"/> record containing forbidden tags and their reasons</returns>
    public static TagDescriptions GetForbiddenTags()
    {
        // Read the forbidden tags JSON file
        var text = File.ReadAllText(Path.Combine(DataFolder, "forbidden-tags.json"));

        // Deserialize to a TagDescriptions record mapping tag names to the reasons they are forbidden
        return JsonSerializer.Deserialize<TagDescriptions>(text)
            // Just in case, the file should be valid
            ?? throw new InvalidOperationException("Forbidden tags parsed to null");
    }
}
