using MathComps.Shared.Converters;
using System.Collections.Immutable;
using System.Text.Json.Serialization;

namespace MathComps.Shared.Localization;

#region Building Blocks

/// <summary>
/// Display names (short and full) for localized metadata entities.
/// Used for both competitions and rounds.
/// </summary>
/// <param name="ShortName">Abbreviated name for compact displays (e.g., "MO" for "Matematická olympiáda").</param>
/// <param name="FullName">Complete official name for formal contexts.</param>
public record LocalizedNames(string ShortName, string FullName);

/// <summary>
/// Lookup of competition slugs to their localized names.
/// </summary>
/// <param name="Data">Dictionary mapping competition slug to display names.</param>
[JsonConverter(typeof(GenericDictionaryWrapperConverter<CompetitionNamesBySlug>))]
public record CompetitionNamesBySlug(ImmutableDictionary<string, LocalizedNames> Data);

/// <summary>
/// Lookup of round slugs to their localized names.
/// </summary>
/// <param name="Data">Dictionary mapping round slug to display names.</param>
[JsonConverter(typeof(GenericDictionaryWrapperConverter<RoundNamesBySlug>))]
public record RoundNamesBySlug(ImmutableDictionary<string, LocalizedNames> Data);

/// <summary>
/// Lookup of category slugs to their round names.
/// </summary>
/// <param name="Data">Dictionary mapping category slug to round names lookup.</param>
[JsonConverter(typeof(GenericDictionaryWrapperConverter<RoundsByCategory>))]
public record RoundsByCategory(ImmutableDictionary<string, RoundNamesBySlug> Data);

/// <summary>
/// Lookup of category slugs to their localized display names.
/// </summary>
/// <param name="Data">Dictionary mapping category slug to display name.</param>
[JsonConverter(typeof(GenericDictionaryWrapperConverter<CategoryNamesBySlug>))]
public record CategoryNamesBySlug(ImmutableDictionary<string, string> Data);

/// <summary>
/// Lookup of competition slugs to their round translations.
/// </summary>
/// <param name="Data">Dictionary mapping competition slug to round configuration.</param>
[JsonConverter(typeof(GenericDictionaryWrapperConverter<RoundsByCompetition>))]
public record RoundsByCompetition(ImmutableDictionary<string, PerLocaleRounds> Data);

#endregion

#region Composite Types

/// <summary>
/// Round translations for a single competition, supporting both category-specific and category-independent rounds.
/// </summary>
/// <param name="WithCategories">Round names that vary by category (e.g., "Z9" category has different round names than "A").</param>
/// <param name="WithoutCategories">Round names shared across all categories or when competition has no categories.</param>
public record PerLocaleRounds(
    RoundsByCategory? WithCategories,
    RoundNamesBySlug? WithoutCategories);

/// <summary>
/// All metadata for a single locale. Deserializes directly from metadata.*.json files.
/// Provides localized display names for competitions, rounds, and categories.
/// </summary>
/// <param name="Competitions">Competition slug to localized names mapping.</param>
/// <param name="Rounds">Competition slug to round translations mapping.</param>
/// <param name="Categories">Category slug to localized display name mapping.</param>
/// <param name="SeasonFormat">Template for season labels with {number}, {start}, {end} placeholders.</param>
public record PerLocaleMetadata(
    CompetitionNamesBySlug Competitions,
    RoundsByCompetition Rounds,
    CategoryNamesBySlug Categories,
    string SeasonFormat)
{
    /// <summary>
    /// Gets the formatted season label by replacing placeholders in the season format template.
    /// </summary>
    /// <param name="editionNumber">The edition/year number of the competition.</param>
    /// <param name="startYear">The calendar year when the season started.</param>
    /// <param name="endYear">The calendar year when the season ended.</param>
    /// <returns>Formatted season label.</returns>
    public string GetSeasonLabel(int editionNumber, int startYear, int endYear) =>
        SeasonFormat
            .Replace("{number}", editionNumber.ToString())
            .Replace("{start}", startYear.ToString())
            .Replace("{end}", endYear.ToString());

    /// <summary>
    /// Gets the round names (short and full) for the specified competition, category, and round.
    /// First tries category-specific rounds, then falls back to category-independent rounds.
    /// Uses competition name if no round is specific found (e.g. default rounds).
    /// </summary>
    /// <param name="competitionSlug">The competition identifier (e.g., "mo", "imo").</param>
    /// <param name="categorySlug">The category identifier (e.g., "a", "b"), or null for category-independent lookup.</param>
    /// <param name="roundSlug">The round identifier (e.g., "school", "regional", "national").</param>
    /// <returns>Localized round names, or null if not found.</returns>
    public LocalizedNames? GetRoundNames(string competitionSlug, string? categorySlug, string? roundSlug)
    {
        // Try explicit round metadata if available AND we have a specific round slug
        if (roundSlug != null && Rounds.Data.TryGetValue(competitionSlug, out var roundsByCompetition))
        {
            // Try category-specific path first
            if (categorySlug != null &&
                roundsByCompetition.WithCategories?.Data.TryGetValue(categorySlug, out var roundsWithCategory) == true &&
                roundsWithCategory.Data.TryGetValue(roundSlug, out var names))
            {
                return names;
            }

            // Try category-independent path
            if (roundsByCompetition.WithoutCategories?.Data.GetValueOrDefault(roundSlug) is { } independentName)
            {
                return independentName;
            }
        }

        // Fallback: If no explicit round definition found, and we are asking for the default round (null slug),
        // use the Competition's own name (e.g. IMO -> IMO).
        return roundSlug == null &&
            Competitions.Data.TryGetValue(competitionSlug, out var competitionNames) ? competitionNames : null;
    }
}

#endregion
