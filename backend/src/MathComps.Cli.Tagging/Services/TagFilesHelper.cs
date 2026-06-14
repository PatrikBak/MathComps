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
/// Exposes the approved tag vocabulary to the AI: the candidate tags keyed by their English display name (the
/// language the model is prompted in). Loading and slug resolution live in <see cref="TagVocabulary"/>; this only
/// shapes the vocabulary into the name-keyed form the generate/veto passes offer the model.
/// </summary>
public static class TagFilesHelper
{
    /// <summary>
    /// The language used for tag names in LLM prompts.
    /// English is used because LLMs perform better with English vocabulary.
    /// </summary>
    public const Language AiLanguage = Language.EN;

    /// <summary>
    /// Gets the approved tags keyed by their <see cref="AiLanguage"/> display name.
    /// </summary>
    /// <returns>Dictionary mapping the <see cref="AiLanguage"/> name → <see cref="TagData"/>.</returns>
    public static ImmutableDictionary<string, TagData> GetTagsForAi() =>
        GetTagsInLocale(AiLanguage);

    /// <summary>
    /// Gets the approved tags keyed by their localized name in a specific language.
    /// </summary>
    /// <param name="language">The language to use for tag names.</param>
    /// <returns>Dictionary mapping localized name → <see cref="TagData"/>.</returns>
    private static ImmutableDictionary<string, TagData> GetTagsInLocale(Language language) =>
        TagVocabulary.LoadByCategory().Data
            .SelectMany(pair => pair.Value.Select(tag => (Tag: tag, Type: pair.Key)))
            .Where(entry => entry.Tag.Names.ContainsKey(language))
            .ToImmutableDictionary(
                entry => entry.Tag.Names[language],
                entry => new TagData(entry.Tag.Slug, entry.Type, entry.Tag.Description));
}
