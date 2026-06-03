using System.Collections.Immutable;
using MathComps.Infrastructure.Constants;
using MathComps.Shared.Localization;

namespace MathComps.Infrastructure.Services;

/// <summary>
/// Implementation of <see cref="IMetadataLocalizationService"/> that loads
/// metadata and tag translations from JSON files.
/// </summary>
public class MetadataLocalizationService : IMetadataLocalizationService
{
    #region Private fields

    /// <summary>
    /// Loaded metadata containing per-locale translations.
    /// </summary>
    private readonly ImmutableDictionary<Language, PerLocaleMetadata> _metadata = LoadAllMetadata();

    /// <summary>
    /// Loaded tag lookup dictionary from slug to localized tag.
    /// </summary>
    private readonly ImmutableDictionary<string, LocalizedTag> _tagLookup = File.ReadAllText(
            Path.Combine(
                AppDomain.CurrentDomain.BaseDirectory,
                ResourcePaths.ApprovedTags))
            .FromJson<LocalizedTagsByCategory>()
            .Data
            .SelectMany(tags => tags.Value)
            .ToImmutableDictionary(tag => tag.Slug, tag => tag);

    #endregion

    #region Public properties

    /// <summary>
    /// The language-neutral taxonomy structure: competitions, their categories and rounds, and the sort
    /// order of all three. Loaded from metadata.shared.json.
    /// </summary>
    public SharedMetadata Shared { get; } = File.ReadAllText(
            Path.Combine(
                AppDomain.CurrentDomain.BaseDirectory,
                ResourcePaths.SharedMetadataFile))
        .FromJson<SharedMetadata>();

    #endregion

    #region IMetadataLocalizationService implementation

    /// <inheritdoc />
    public string GetCompetitionShortName(Language language, string slug) =>
        GetMetadata(language).Competitions?.Data.GetValueOrDefault(slug)?.ShortName
            ?? throw MissingLocalization("competition", slug, language);

    /// <inheritdoc />
    public string GetCompetitionFullName(Language language, string slug) =>
        GetMetadata(language).Competitions?.Data.GetValueOrDefault(slug)?.FullName
            ?? throw MissingLocalization("competition", slug, language);

    /// <inheritdoc />
    public string GetRoundShortName(Language language, string competitionSlug, string? categorySlug, string? roundSlug) =>
        GetMetadata(language).GetRoundNames(competitionSlug, categorySlug, roundSlug)?.ShortName
            ?? throw MissingLocalization("round", $"{competitionSlug}/{categorySlug ?? "null"}/{roundSlug ?? "null"}", language);

    /// <inheritdoc />
    public string GetRoundFullName(Language language, string competitionSlug, string? categorySlug, string? roundSlug) =>
        GetMetadata(language).GetRoundNames(competitionSlug, categorySlug, roundSlug)?.FullName
            ?? throw MissingLocalization("round", $"{competitionSlug}/{categorySlug ?? "null"}/{roundSlug ?? "null"}", language);

    /// <inheritdoc />
    public string GetCategoryName(Language language, string slug) =>
        GetMetadata(language).Categories?.Data.GetValueOrDefault(slug)
            ?? throw MissingLocalization("category", slug, language);

    /// <inheritdoc />
    public string GetTagName(Language language, string slug) =>
        _tagLookup.TryGetValue(slug, out var tag)
            ? tag.Names.GetValueOrDefault(language) ?? throw MissingLocalization("tag name", $"{slug}/{language}", language)
            : throw MissingLocalization("tag", slug, language);

    /// <inheritdoc />
    public string GetSeasonLabel(Language language, int editionNumber, int startYear, int endYear) =>
        GetMetadata(language).GetSeasonLabel(editionNumber, startYear, endYear);

    #endregion

    #region Private Helpers

    /// <summary>
    /// Gets the metadata for a specific language, throwing if not loaded.
    /// </summary>
    /// <param name="language">The language to get the metadata for.</param>
    /// <returns>The metadata for the specified language.</returns>
    private PerLocaleMetadata GetMetadata(Language language) =>
        _metadata.TryGetValue(language, out var metadata)
            ? metadata
            : throw new InvalidOperationException(
                $"No metadata loaded for locale '{language}'. " +
                $"Check that metadata.{language.ToString().ToLowerInvariant()}.json exists.");

    /// <summary>
    /// Creates an exception for missing localization data.
    /// </summary>
    /// <param name="entityType">The type of the entity, e.g. "competition", "round", "category", "tag", "seasonFormat".</param>
    /// <param name="identifier">The identifier of the entity, e.g. IMO, CSMO/A/I, MEMO-I.</param>
    /// <param name="language">The language.</param>
    /// <returns>An exception for missing localization data.</returns>
    private static InvalidOperationException MissingLocalization(
        string entityType,
        string identifier,
        Language language) =>
        new($"Missing localization for {entityType} '{identifier}' in locale '{language}'.");

    /// <summary>
    /// Loads all metadata from per-locale JSON files.
    /// </summary>
    /// <returns>The metadata for all locales.</returns>
    private static ImmutableDictionary<Language, PerLocaleMetadata> LoadAllMetadata()
    {
        // We'll be loading from this directory
        var directory = Path.Combine(
            AppDomain.CurrentDomain.BaseDirectory,
            LocalizationConstants.MetadataDirectory);

        // Fail quickly if directory doesn't exist
        return !Directory.Exists(directory)
            ? throw new InvalidOperationException($"Metadata directory '{directory}' does not exist.")
            // Load all metadata from per-locale JSON files
            : Directory.GetFiles(directory, "metadata.*.json")
                // Skip the language-neutral structural file (metadata.shared.json) — it's not a locale.
                .Where(file => Path.GetFileName(file) != Path.GetFileName(ResourcePaths.SharedMetadataFile))
                // Build a dictionary mapping language to its metadata
                .ToImmutableDictionary(
                    ParseLanguageFromFile,
                    file => File.ReadAllText(file).FromJson<PerLocaleMetadata>());
    }

    /// <summary>
    /// Parses the language from a metadata filename (e.g., "metadata.sk.json" → SK).
    /// </summary>
    /// <param name="filePath">The path to the metadata file.</param>
    /// <returns>The language parsed from the filename.</returns>
    private static Language ParseLanguageFromFile(string filePath)
    {
        // First get metadata.en.json or so (no .json) and then get the locale
        var locale = Path.GetFileNameWithoutExtension(filePath).Split('.').Last();

        // Try to parse the locale as a Language enum
        return Enum.TryParse<Language>(locale, ignoreCase: true, out var language)
            ? language
            : throw new InvalidOperationException($"Failed to parse language from filename '{filePath}'.");
    }

    #endregion
}
