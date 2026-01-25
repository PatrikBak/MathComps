using System.Collections.Immutable;
using System.Text.Json.Serialization;
using MathComps.Shared.Converters;

namespace MathComps.Shared.Localization;

/// <summary>
/// Represents a single tag with localized display names for all supported languages.
/// This structure matches the format in approved-tags.json.
/// </summary>
/// <param name="Slug">The language-neutral slug identifier for the tag.</param>
/// <param name="Names">Dictionary mapping language to display name.</param>
/// <param name="Description">Description of the tag for AI tagging assistance.</param>
public record LocalizedTag(
    string Slug,
    ImmutableDictionary<Language, string> Names,
    string Description);

/// <summary>
/// Represents tags organized by category in the dictionary-based format.
/// Uses <see cref="GenericDictionaryWrapperConverter{TRecord}"/> to serialize
/// directly as a JSON object with <see cref="TagType"/> keys (Area, Goal, Type, Technique).
/// </summary>
/// <param name="Data">Dictionary mapping tag type to array of localized tags.</param>
[JsonConverter(typeof(GenericDictionaryWrapperConverter<LocalizedTagsByCategory>))]
public record LocalizedTagsByCategory(
    ImmutableDictionary<TagType, ImmutableArray<LocalizedTag>> Data);
