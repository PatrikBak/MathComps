using System.Collections.Immutable;
using MathComps.Infrastructure.Constants;
using MathComps.Domain.Taxonomy;
using MathComps.Domain.Localization;
using MathComps.Domain.Tagging;
using MathComps.Domain.Resources;
using MathComps.Shared.Serialization;

namespace MathComps.Infrastructure.Services.Localization;

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
    /// order of all three. Loaded from <see cref="ResourcePaths.SharedMetadataFileName"/>.
    /// </summary>
    public SharedMetadata Shared { get; } = File.ReadAllText(
            Path.Combine(
                AppDomain.CurrentDomain.BaseDirectory,
                ResourcePaths.SharedMetadataFile))
        .FromJson<SharedMetadata>();

    #endregion

    #region IMetadataLocalizationService implementation

    /// <inheritdoc />
    public string GetNodeShortName(Language language, string path) =>
        GetMetadata(language).GetNodeNames(path)?.ShortName
            ?? throw MissingLocalization("contest", path, language);

    /// <inheritdoc />
    public string GetNodeFullName(Language language, string path) =>
        GetMetadata(language).GetNodeNames(path)?.FullName
            ?? throw MissingLocalization("contest", path, language);

    /// <inheritdoc />
    public string GetTagName(Language language, string slug) =>
        _tagLookup.TryGetValue(slug, out var tag)
            ? tag.Names.GetValueOrDefault(language) ?? throw MissingLocalization("tag name", $"{slug}/{language}", language)
            : throw MissingLocalization("tag", slug, language);

    /// <inheritdoc />
    public string GetSeasonLabel(Language language, int editionNumber, int startYear, int endYear) =>
        GetMetadata(language).GetSeasonLabel(editionNumber, startYear, endYear);

    /// <inheritdoc />
    public IReadOnlyList<TaxonomyRegistryIssue> ValidateTaxonomyRegistration(
        string competitionSlug,
        string? categorySlug,
        string? roundSlug)
    {
        // Collect every gap across the referenced competition / category / round slugs.
        var issues = new List<TaxonomyRegistryIssue>();

        // Competition: its structural entry in the shared backbone …
        var competitionEntry = Shared.Competitions.FirstOrDefault(competition => competition.Slug == competitionSlug);

        // Check if competition missing in some locale
        var competitionMissingLocales = LocalesMissing(metadata =>
            HasBothNames(metadata, competitionSlug));

        // Report the competition only when something's actually missing.
        if (competitionEntry is null || competitionMissingLocales.Length > 0)
            issues.Add(new TaxonomyRegistryIssue(
                TaxonomyEntityKind.Competition,
                competitionSlug,
                MissingFromSharedStructure: competitionEntry is null,
                competitionMissingLocales));

        // Category is only referenced when the competition carries categories.
        if (categorySlug is not null)
        {
            // Structural: in the global category list, and listed under this competition when the competition exists.
            var categoryMissingFromShared =
                !Shared.Categories.Contains(categorySlug) ||
                (competitionEntry?.Categories is { } competitionCategories && !competitionCategories.Contains(categorySlug));

            // A category is named per competition, so its path is what a locale keys its name by.
            var categoryPath = TaxonomySlugs.ComposeRoundSlug(competitionSlug, categorySlug, round: null);

            // Check if category missing in some locale
            var categoryMissingLocales = LocalesMissing(metadata =>
                HasBothNames(metadata, categoryPath));

            // Report only on a real gap.
            if (categoryMissingFromShared || categoryMissingLocales.Length > 0)
                issues.Add(new TaxonomyRegistryIssue(
                    TaxonomyEntityKind.Category,
                    categoryPath,
                    categoryMissingFromShared,
                    categoryMissingLocales));
        }

        // Round is referenced as the (competition, category, round) triple.
        // Structural: the competition lists this round (a null round is the default round, i.e. no listed rounds).
        var roundMissingFromShared = roundSlug is null
            ? competitionEntry is not null && competitionEntry.Rounds.Length > 0
            : competitionEntry is null || !competitionEntry.Rounds.Contains(roundSlug);

        // Identify the round by its path (e.g. "csmo-a-iii"), so the gap names the exact key to look for. A
        // default round stands for its whole competition, whose path is the competition slug on its own.
        var roundIdentifier = roundSlug is null
            ? competitionSlug
            : TaxonomySlugs.ComposeRoundSlug(competitionSlug, categorySlug, roundSlug);

        // Check if round missing in some locale
        var roundMissingLocales = LocalesMissing(metadata =>
            HasBothNames(metadata, roundIdentifier));

        // Report only on a real gap.
        if (roundMissingFromShared || roundMissingLocales.Length > 0)
            issues.Add(new TaxonomyRegistryIssue(
                TaxonomyEntityKind.Round,
                roundIdentifier,
                roundMissingFromShared,
                roundMissingLocales));

        // Hand back every gap found (possibly none).
        return issues;
    }

    #endregion

    #region Private Helpers

    /// <summary>
    /// Whether a locale names a node at all — both names, since a reader asks for either one and an
    /// entry carrying only a short name resolves right up until something reads the full one.
    /// </summary>
    /// <param name="metadata">The locale's loaded metadata.</param>
    /// <param name="path">The node's path.</param>
    /// <returns>True when the locale carries both names for it.</returns>
    private static bool HasBothNames(PerLocaleMetadata metadata, string path) =>
        // A name the JSON omits deserializes to null, which no key check would catch.
        metadata.GetNodeNames(path) is { ShortName.Length: > 0, FullName.Length: > 0 };

    /// <summary>
    /// Returns the locales a slug is missing from — those whose loaded metadata fails the given presence
    /// predicate, plus any locale whose file didn't load at all. Evaluates all three so the caller sees every
    /// gap at once.
    /// </summary>
    /// <param name="isPresent">Predicate returning true when the slug is present in a locale's metadata.</param>
    /// <returns>The locales where the slug is absent, in enum order.</returns>
    private ImmutableArray<Language> LocalesMissing(Func<PerLocaleMetadata, bool> isPresent) =>
        [.. Enum.GetValues<Language>().Where(locale =>
            !(_metadata.TryGetValue(locale, out var metadata) && isPresent(metadata)))];

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
    /// <param name="entityType">The type of the entity, e.g. "contest", "tag".</param>
    /// <param name="identifier">The identifier of the entity, e.g. imo, csmo-a-iii, memo-i.</param>
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
