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
            metadata.Competitions?.Data.ContainsKey(competitionSlug) == true);

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

            // Check if category missing in some locale
            var categoryMissingLocales = LocalesMissing(metadata =>
                metadata.Categories?.Data.ContainsKey(categorySlug) == true);

            // Report only on a real gap.
            if (categoryMissingFromShared || categoryMissingLocales.Length > 0)
                issues.Add(new TaxonomyRegistryIssue(
                    TaxonomyEntityKind.Category,
                    categorySlug,
                    categoryMissingFromShared,
                    categoryMissingLocales));
        }

        // Round is referenced as the (competition, category, round) composite.
        // Structural: the competition lists this round (a null round is the default round, i.e. no listed rounds).
        var roundMissingFromShared = roundSlug is null
            ? competitionEntry is not null && competitionEntry.Rounds.Length > 0
            : competitionEntry is null || !competitionEntry.Rounds.Contains(roundSlug);

        // Check if round missing in some locale
        var roundMissingLocales = LocalesMissing(metadata =>
            metadata.GetRoundNames(competitionSlug, categorySlug, roundSlug) is not null);

        // Identify the round by its composite slug (e.g. "csmo-a-iii") — a round's canonical key form, so the gap
        // names the exact key to look for. A default round (null slug) is keyed under the competition itself.
        var roundIdentifier = roundSlug is null
            ? competitionSlug
            : TaxonomySlugs.ComposeRoundSlug(competitionSlug, categorySlug, roundSlug);

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
