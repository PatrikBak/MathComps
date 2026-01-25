using MathComps.Shared;
using MathComps.Shared.Localization;
using System.Collections.Immutable;

namespace MathComps.Cli.Tagging.Services;

/// <summary>
/// Resolved tag data containing the canonical slug, type, and description.
/// </summary>
/// <param name="Slug">The language-neutral slug identifier.</param>
/// <param name="Type">The category of the tag.</param>
/// <param name="Description">Description of the tag for AI tagging assistance.</param>
public record TagData(string Slug, TagType Type, string Description);

/// <summary>
/// Static methods for loading tag-related files with support for categorized tag vocabulary.
/// Delegates to <see cref="TagLoadingService"/> for the actual JSON parsing.
/// </summary>
public static class TagFilesHelper
{
    /// <summary>
    /// The language used for tag names in LLM prompts.
    /// English is used because LLMs perform better with English vocabulary.
    /// </summary>
    public const Language AiLanguage = Language.EN;

    /// <summary>
    /// The path to the file with forbidden tags.
    /// </summary>
    public static readonly string ForbiddenTagsPath = Path.Combine(
        AppDomain.CurrentDomain.BaseDirectory,
        "Data",
        "forbidden-tags.json"
    );

    /// <summary>
    /// Read forbidden tags with their reasons from the JSON file.
    /// </summary>
    /// <returns>Forbidden tags and their reasons</returns>
    public static Dtos.TagDescriptions GetForbiddenTags() =>
        File.ReadAllText(ForbiddenTagsPath).FromJson<Dtos.TagDescriptions>();

    /// <summary>
    /// Read categorized approved tags with their types,
    /// converted to the <see cref="Dtos.TagsByCategory"/> format for CLI tool workflows.
    /// </summary>
    /// <returns>Tags with their type and description (slug as key)</returns>
    public static Dtos.TagsByCategory GetCategorizedApprovedTags()
        => ConvertToTagsByCategory(LoadLocalizedTags());

    /// <summary>
    /// Creates an index that maps any tag identifier (slug or localized name in any language)
    /// to its canonical tag data. This enables CLI commands to accept
    /// tag names in any language and resolve them to the correct slug.
    /// </summary>
    /// <returns>A lookup from any name/slug to <see cref="TagData"/></returns>
    public static ImmutableDictionary<string, TagData> GetTagLookupIndex() =>
        LoadLocalizedTags().Data
            .SelectMany(pair => pair.Value.Select(tag => (Tag: tag, Type: pair.Key)))
            .SelectMany(entry =>
                // Each tag contributes: slug + all localized names as keys
                entry.Tag.Names.Values
                    .Prepend(entry.Tag.Slug)
                    .Select(key => (Key: key, Data: new TagData(entry.Tag.Slug, entry.Type, entry.Tag.Description))))
            .ToImmutableDictionary(pair => pair.Key, pair => pair.Data);

    /// <summary>
    /// Gets tags keyed by their localized name in a specific language.
    /// </summary>
    /// <param name="language">The language to use for tag names.</param>
    /// <returns>Dictionary mapping localized name → <see cref="TagData"/> (which contains the slug)</returns>
    public static ImmutableDictionary<string, TagData> GetTagsInLocale(Language language) =>
        LoadLocalizedTags().Data
            .SelectMany(pair => pair.Value.Select(tag => (Tag: tag, Type: pair.Key)))
            .Where(entry => entry.Tag.Names.ContainsKey(language))
            .ToImmutableDictionary(
                entry => entry.Tag.Names[language],
                entry => new TagData(entry.Tag.Slug, entry.Type, entry.Tag.Description));

    /// <summary>
    /// Gets tags keyed by <see cref="AiLanguage"/>.
    /// </summary>
    /// <returns>Dictionary mapping the AiLanguage name → <see cref="TagData"/></returns>
    public static ImmutableDictionary<string, TagData> GetTagsForAi() =>
        GetTagsInLocale(AiLanguage);

    /// <summary>
    /// Loads the raw localized tags from the JSON file.
    /// </summary>
    /// <returns>Localized tags organized by category</returns>
    private static LocalizedTagsByCategory LoadLocalizedTags() =>
        File.ReadAllText(
            Path.Combine(
                AppDomain.CurrentDomain.BaseDirectory,
                ResourcePaths.ApprovedTags
            )
        ).FromJson<LocalizedTagsByCategory>();

    /// <summary>
    /// Converts the shared <see cref="LocalizedTagsByCategory"/> to the CLI's <see cref="Dtos.TagsByCategory"/> format.
    /// </summary>
    /// <param name="tags">The localized tags organized by category</param>
    /// <returns>Tags with their type and description (slug as key)</returns>
    private static Dtos.TagsByCategory ConvertToTagsByCategory(LocalizedTagsByCategory tags)
    {
        // A helper to convert an array of LocalizedTag to a dictionary of tag descriptions
        static Dtos.TagDescriptions ToDescriptions(ImmutableArray<LocalizedTag> tagArray) =>
            new(tagArray.ToImmutableDictionary(tag => tag.Slug, tag => tag.Description));

        // Map each category from the source dictionary to the CLI format
        return new Dtos.TagsByCategory(
            tags.Data.ToImmutableDictionary(
                pair => pair.Key,
                pair => ToDescriptions(pair.Value)
            )
        );
    }
}
