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
/// Lookup of composite round slugs to their localized names.
/// </summary>
/// <param name="Data">Dictionary mapping composite round slug (e.g. "csmo-a-iii", "memo-i") to display names.</param>
[JsonConverter(typeof(GenericDictionaryWrapperConverter<RoundNamesBySlug>))]
public record RoundNamesBySlug(ImmutableDictionary<string, LocalizedNames> Data);

/// <summary>
/// Lookup of category slugs to their localized display names.
/// </summary>
/// <param name="Data">Dictionary mapping category slug to display name.</param>
[JsonConverter(typeof(GenericDictionaryWrapperConverter<CategoryNamesBySlug>))]
public record CategoryNamesBySlug(ImmutableDictionary<string, string> Data);

#endregion

#region Composite Types

/// <summary>
/// Localized display names for one locale, deserialized directly from a metadata.{locale}.json file:
/// names for competitions, rounds, and categories, plus the season-label template.
/// </summary>
/// <param name="Competitions">Competition slug to localized names mapping.</param>
/// <param name="Rounds">Composite round slug (e.g. "csmo-a-iii", "memo-i") to localized names mapping.</param>
/// <param name="Categories">Category slug to localized display name mapping.</param>
/// <param name="SeasonFormat">Template for season labels with {number}, {start}, {end} placeholders.</param>
public record PerLocaleMetadata(
    CompetitionNamesBySlug Competitions,
    RoundNamesBySlug Rounds,
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
    /// Gets the round names (short and full) for the specified competition, category, and round. Composes the
    /// composite round slug (e.g. "csmo-a-iii", "memo-i") and looks it up. A null round slug means the
    /// competition's single default round, which uses the competition's own name (e.g. IMO -> IMO).
    /// </summary>
    /// <param name="competitionSlug">The competition identifier (e.g., "csmo", "imo").</param>
    /// <param name="categorySlug">The category identifier (e.g., "a", "b"), or null when the competition has no categories.</param>
    /// <param name="roundSlug">The round identifier (e.g., "iii", "i", "d1"), or null for a default round.</param>
    /// <returns>Localized round names, or null if not found.</returns>
    public LocalizedNames? GetRoundNames(string competitionSlug, string? categorySlug, string? roundSlug)
    {
        // A default round (null slug) has no round name of its own — use the competition's own name.
        if (roundSlug == null)
            return Competitions.Data.GetValueOrDefault(competitionSlug);

        // Look up the round under its composite slug; null when the locale has no entry for it.
        return Rounds.Data.GetValueOrDefault(TaxonomySlugs.ComposeRoundSlug(competitionSlug, categorySlug, roundSlug));
    }
}

#endregion
