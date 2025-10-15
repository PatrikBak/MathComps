using MathComps.Cli.Tagging.Dtos;
using MathComps.Domain.EfCoreEntities;
using MathComps.Shared;
using System.Collections.Immutable;

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
    public static ImmutableDictionary<TagType, ImmutableList<string>> GetCategorizedApprovedTags()
    {
        // The committed data file contains categorized tags in section-based format.
        var result = ReadSectionBasedTagList(Path.Combine(DataFolder, "approved-tags.txt"))
            // Organize the data
            .GroupBy(tag => tag.TagType)
            .ToImmutableDictionary(
                group => group.Key,
                group => group.Select(tag => tag.Name).ToImmutableList()
            );

        // Before returning, make sure no duplicates in the tag names and slugs aren't there
        static void EnsureNoDuplicates(IEnumerable<string> values)
        {
            // Find values that are there more than once
            var duplicates = values
                .GroupBy(_ => _)
                .Where(group => group.Skip(1).Any())
                .Select(group => group.Key)
                .ToList();

            // Make aware if there's any
            if (duplicates.Count != 0)
                throw new InvalidOperationException($"We have non-unique values: {duplicates.Order().ToJoinedString()}");
        }

        // Make sure both names and slugs have no duplicates
        EnsureNoDuplicates(result.Values.Flatten());
        EnsureNoDuplicates(result.Values.Flatten().Select(tag => tag.ToSlug()));

        // Otherwise we're gud
        return result;
    }

    /// <summary>
    /// Read the tags we don't want AI to keep suggesting
    /// </summary>
    /// <returns>A tag list</returns>
    public static ImmutableList<string> GetForbiddenTags()
        // The committed data file has it
        => ReadTagList(Path.Combine(DataFolder, "forbidden-tags.txt"));

    /// <summary>
    /// Write AI's categorized tag suggestions in the same format as approved-tags.txt for easy manual merging.
    /// </summary>
    /// <param name="suggestedTagsJson">The JSON response from the AI containing categorized tag suggestions.</param>
    /// <param name="tags">Already parsed and deduplicated tags</param>
    /// <param name="problems">The slugs of problems it used to infer the tags, written for debugging purposes.</param>
    public static void WriteSuggestedTags(string suggestedTagsJson, TagCollection? suggestion, ImmutableList<string> problems)
    {
        // The header
        var output = new List<string>
        {
            "AI-Suggested Tags",
            $"Generated: {DateTime.Now:yyyy-MM-dd HH:mm:ss}",
            $"Based on {problems.Count} problems",
            "",
            "Original AI Response (for debugging):",
            $"{suggestedTagsJson}",
        };

        // If non-null tags, we'll write them nicely
        if (suggestion != null)
        {
            // Area tags
            if (suggestion.Area?.Length > 0)
            {
                // Write ordered tags under the right section
                output.Add("[area]");
                output.Add("");
                output.AddRange(suggestion.Area.Order());
                output.Add("");
            }

            // Type tags
            if (suggestion.Type?.Length > 0)
            {
                // Write ordered tags under the right section
                output.Add("[type]");
                output.Add("");
                output.AddRange(suggestion.Type.Order());
                output.Add("");
            }

            // Technique tags
            if (suggestion.Technique?.Length > 0)
            {
                // Write ordered tags under the right section
                output.Add("[technique]");
                output.Add("");
                output.AddRange(suggestion.Technique.Order());
                output.Add("");
            }

            // Handle when no new tags
            if (suggestion.GetAllTags().IsEmpty)
                output.Add("No new tags suggested");
        }

        // Write problems based on which the tags were selected for debugging
        output.Add("Problems analyzed:");
        output.AddRange(problems);

        // Create a timestamp for the file, nicely formatted
        var path = Path.Combine(DataFolder, "SuggestedTags", $"{DateTime.Now:yyyy-MM-dd_HH-mm-ss}.txt");

        // Ensure directory exists
        Directory.CreateDirectory(Path.GetDirectoryName(path)!);

        // Write the formatted output
        File.WriteAllLines(path, output);
    }

    /// <summary>
    /// Reads a newline-separated tag list from a text file, ignoring empty lines and lines starting with '#'.
    /// </summary>
    /// <param name="filePath">The tag file path</param>
    /// <returns>The tags</returns>
    private static ImmutableList<string> ReadTagList(string filePath)
        // Read the file
        => [.. File.ReadAllLines(filePath)
            // Ignore empty lines and comments
            .Where(line => !string.IsNullOrWhiteSpace(line) && !line.TrimStart().StartsWith('#'))
            // Trim out stuff
            .Select(line => line.Trim()),];

    /// <summary>
    /// Reads categorized tags from a section-based text file format. Sections are defined by
    /// [area], [type], [technique] headers. Lines starting with '#' are treated as comments and ignored.
    /// </summary>
    /// <param name="filePath">The section-based tag file path</param>
    /// <returns>Tuples of (Name, TagType) for each valid tag entry</returns>
    private static ImmutableList<(string Name, TagType TagType)> ReadSectionBasedTagList(string filePath)
    {
        // Read the file
        var lines = File.ReadAllLines(filePath);

        // We'll process it line by line and keep adding tags here
        var result = new List<(string Name, TagType TagType)>();

        // We need to keep remembering the current section
        TagType? currentSection = null;

        // Handle each ine
        foreach (var line in lines)
        {
            // Clean the line
            var trimmedLine = line.Trim();

            // Skip empty lines and comments
            if (string.IsNullOrWhiteSpace(trimmedLine) || trimmedLine.StartsWith('#'))
                continue;

            // Check for section headers
            if (trimmedLine.StartsWith('[') && trimmedLine.EndsWith(']'))
            {
                // Get the header section
                var sectionName = trimmedLine[1..^1].ToLowerInvariant();

                // Parse it
                currentSection = sectionName switch
                {
                    "area" => TagType.Area,
                    "type" => TagType.Type,
                    "technique" => TagType.Technique,
                    _ => throw new InvalidOperationException($"Unknown section '{sectionName}' in {filePath}. Valid sections: [area], [type], [technique]."),
                };

                // Carry on, the line is okay
                continue;
            }

            // Tag entries must be within a section
            if (currentSection == null)
                throw new InvalidOperationException($"Tag '{trimmedLine}' found outside of any section in {filePath}. Tags must be under [area], [type], or [technique] sections.");

            // We have a valid entry
            result.Add((Name: trimmedLine, TagType: currentSection.Value));
        }

        // We're done
        return [.. result];
    }
}
