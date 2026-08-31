using System.Collections.Immutable;
using MathComps.Domain.EfCoreEntities;
using MathComps.Domain.Localization;
using MathComps.Domain.Resources;
using MathComps.Shared.Extensions;

namespace MathComps.Domain.Taxonomy;

/// <summary>
/// One competition on a named path, that the registry doesn't back as somewhere problems
/// can land: it's absent from the structural backbone (<see cref="ResourcePaths.SharedMetadataFileName"/>),
/// missing a localized name in one or more locale files, or — for the competition the path ends at — carrying a
/// generation below it. A competition must be present in both files for it to render in production, and a
/// competition carrying others below it is a container rather than a sitting, so each gap is blocking.
/// </summary>
/// <param name="Path"><inheritdoc cref="Competition.Path" path="/summary"/></param>
/// <param name="MissingFromSharedStructure">True when the competition has no structural entry in
/// <see cref="ResourcePaths.SharedMetadataFileName"/>.</param>
/// <param name="MissingLocales">Locales whose <c>metadata.{locale}.json</c> carries no localized name for the
/// competition.</param>
/// <param name="CarriesNestedCompetitions">True when this competition is the one the path ends at and the
/// registry gives it competitions below it, which are the ones that were supposed to be picked from.</param>
public record TaxonomyRegistryIssue(
    string Path,
    bool MissingFromSharedStructure,
    ImmutableArray<Language> MissingLocales,
    bool CarriesNestedCompetitions)
{
    /// <summary>
    /// The gaps this competition has, in one readable clause. A competition can carry several at once, so they
    /// are joined rather than picked between.
    /// </summary>
    public string Gaps
    {
        get
        {
            // Whichever gaps this competition has.
            var gaps = new List<string>();

            // The structural backbone is missing it entirely.
            if (MissingFromSharedStructure)
                gaps.Add($"no structural entry in {ResourcePaths.SharedMetadataFileName}");

            // Some locales carry no localized name for it.
            if (MissingLocales.Length > 0)
            {
                var locales = MissingLocales.Select(language => language.ToString().ToLowerInvariant());
                gaps.Add($"no localized name in {locales.ToJoinedString()}");
            }

            // It is registered, but as a container rather than a sitting anything may name.
            if (CarriesNestedCompetitions)
                gaps.Add("competitions nested below it, so one of those is named instead");

            // The whole account of what it is short of.
            return gaps.ToJoinedString("; ");
        }
    }
}
