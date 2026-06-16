using System.Collections.Immutable;
using System.Text.Json.Serialization;
using MathComps.Domain.Localization;
using MathComps.Domain.Resources;
using MathComps.Shared.Serialization;

namespace MathComps.Domain.Tagging;

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

/// <summary>
/// The single home for the approved tag vocabulary: loads <c>approved-tags.json</c> and resolves a slug to its
/// <see cref="TagType"/>. Shared across the bulk-import preflight, apply, and the Tagging CLI so the
/// "is this an approved slug, and what category is it?" rule lives in exactly one place.
/// </summary>
public static class TagVocabulary
{
    /// <summary>
    /// The vocabulary loaded once from disk on first access. Slug lookups read the cached snapshot rather than
    /// re-reading the JSON file per call (apply resolves a type for every slug it writes).
    /// </summary>
    private static readonly Lazy<ImmutableDictionary<string, TagType>> _slugToTagType =
        new(BuildSlugToTagType);

    /// <summary>
    /// Loads the raw localized tag vocabulary organized by category from <see cref="ResourcePaths.ApprovedTags"/>,
    /// resolved relative to the application base directory (the file is copied into every project's output).
    /// </summary>
    /// <returns>The approved tags organized by category.</returns>
    public static LocalizedTagsByCategory LoadByCategory() =>
        File.ReadAllText(
            Path.Combine(
                AppDomain.CurrentDomain.BaseDirectory,
                ResourcePaths.ApprovedTags
            )
        ).FromJson<LocalizedTagsByCategory>();

    /// <summary>
    /// Resolves a slug to its <see cref="TagType"/>. Matching is case-insensitive against the canonical
    /// lowercase-kebab slugs in the vocabulary.
    /// </summary>
    /// <param name="slug">The slug to resolve.</param>
    /// <returns>The tag's category, or <c>null</c> if the slug is not in the approved vocabulary.</returns>
    public static TagType? TryGetTagType(string slug) =>
        _slugToTagType.Value.TryGetValue(Canonicalize(slug), out var tagType) ? tagType : null;

    /// <summary>
    /// Whether the given slug exists in the approved vocabulary (case-insensitive).
    /// </summary>
    /// <param name="slug">The slug to check.</param>
    /// <returns><c>true</c> if the slug is approved.</returns>
    public static bool IsKnownSlug(string slug) =>
        _slugToTagType.Value.ContainsKey(Canonicalize(slug));

    /// <summary>
    /// Builds the slug → <see cref="TagType"/> map from the on-disk vocabulary. Slugs are globally unique across
    /// categories, so each canonical slug maps to exactly one type.
    /// </summary>
    /// <returns>A case-insensitive map from canonical slug to its category.</returns>
    private static ImmutableDictionary<string, TagType> BuildSlugToTagType() =>
        LoadByCategory().Data
            .SelectMany(pair => pair.Value.Select(tag => (Slug: Canonicalize(tag.Slug), Type: pair.Key)))
            .ToImmutableDictionary(entry => entry.Slug, entry => entry.Type);

    /// <summary>
    /// Canonicalizes a slug for comparison and storage: trims surrounding whitespace and lowercases it, matching the
    /// lowercase-kebab convention the vocabulary uses. Shared so every slug comparison folds the same way — a
    /// divergence would let a slug pass validation yet fail to resolve.
    /// </summary>
    /// <param name="slug">The slug to canonicalize.</param>
    /// <returns>The canonical slug.</returns>
    public static string Canonicalize(string slug) => slug.Trim().ToLowerInvariant();
}
