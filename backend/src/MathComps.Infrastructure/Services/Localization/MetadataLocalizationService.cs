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
    /// The language-neutral taxonomy structure: the tree of competition nodes and the sort order of each generation.
    /// Loaded from <see cref="ResourcePaths.SharedMetadataFileName"/>.
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
            ?? throw MissingLocalization("competition", path, language);

    /// <inheritdoc />
    public string GetNodeFullName(Language language, string path) =>
        GetMetadata(language).GetNodeNames(path)?.FullName
            ?? throw MissingLocalization("competition", path, language);

    /// <inheritdoc />
    public string GetTagName(Language language, string slug) =>
        _tagLookup.TryGetValue(slug, out var tag)
            ? tag.Names.GetValueOrDefault(language) ?? throw MissingLocalization("tag name", $"{slug}/{language}", language)
            : throw MissingLocalization("tag", slug, language);

    /// <inheritdoc />
    public string GetSeasonLabel(Language language, int editionNumber, int startYear, int endYear) =>
        GetMetadata(language).GetSeasonLabel(editionNumber, startYear, endYear);

    /// <inheritdoc />
    public IReadOnlyList<TaxonomyRegistryIssue> ValidateTaxonomyRegistration(string competitionPath) =>
        // Every competition the path runs through, root-down and the one it names last, each reported when the
        // registry doesn't back it. OfType drops the ones that came back clean.
        [.. CompetitionTree.Descend(competitionPath)
            .Select(node => GapAt(node.Path, isTarget: node.Path == competitionPath))
            .OfType<TaxonomyRegistryIssue>()];

    #endregion

    #region Private Helpers

    /// <summary>
    /// The registry gap at one competition on a draft's path, or null when the registry fully backs it.
    /// </summary>
    /// <param name="path">The competition's path.</param>
    /// <param name="isTarget">Whether the path ends here, i.e. this competition is the one the draft names.</param>
    /// <returns>The gap found, or null when there is none.</returns>
    private TaxonomyRegistryIssue? GapAt(string path, bool isTarget)
    {
        // The structural entry placing it, null when the registry carries none.
        var entry = Shared.Node(path);

        // The locales that don't name it.
        var missingLocales = LocalesMissing(metadata => HasBothNames(metadata, path));

        // The one a draft names has to be a sitting: one carrying a generation below it holds the competitions the
        // draft was supposed to pick from. Everything above it is expected to carry one.
        var carriesNestedCompetitions = isTarget && entry?.Children is { IsDefaultOrEmpty: false };

        // Report only on a real gap.
        return entry is null || missingLocales.Length > 0 || carriesNestedCompetitions
            ? new TaxonomyRegistryIssue(
                path,
                MissingFromSharedStructure: entry is null,
                missingLocales,
                carriesNestedCompetitions)
            : null;
    }

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
    /// <param name="entityType">The type of the entity, e.g. "competition", "tag".</param>
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
