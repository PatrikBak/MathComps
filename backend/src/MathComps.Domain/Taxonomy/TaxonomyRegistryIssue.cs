using System.Collections.Immutable;
using MathComps.Domain.EfCoreEntities;
using MathComps.Domain.Localization;
using MathComps.Domain.Resources;

namespace MathComps.Domain.Taxonomy;

/// <summary>
/// One competition on the path a draft names its contest by that the registry doesn't back as somewhere problems
/// can land: it's absent from the structural backbone (<see cref="ResourcePaths.SharedMetadataFileName"/>),
/// missing a localized name in one or more locale files, or — for the contest the path ends at — carrying a
/// generation below it. A competition must be present in both files for it to render in production, and a
/// contest carrying others below it is a container rather than a sitting, so each gap is a preflight failure.
/// </summary>
/// <param name="Path"><inheritdoc cref="Competition.Path" path="/summary"/></param>
/// <param name="MissingFromSharedStructure">True when the competition has no structural entry in
/// <see cref="ResourcePaths.SharedMetadataFileName"/>.</param>
/// <param name="MissingLocales">Locales whose <c>metadata.{locale}.json</c> carries no localized name for the
/// competition.</param>
/// <param name="CarriesNestedContests">True when the draft names this competition as its contest and the
/// registry gives it competitions below it, which are the ones the draft was supposed to pick from.</param>
public record TaxonomyRegistryIssue(
    string Path,
    bool MissingFromSharedStructure,
    ImmutableArray<Language> MissingLocales,
    bool CarriesNestedContests);
