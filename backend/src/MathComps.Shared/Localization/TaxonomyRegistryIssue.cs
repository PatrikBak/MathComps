using System.Collections.Immutable;

namespace MathComps.Shared.Localization;

/// <summary>
/// Which kind of taxonomy slug a registry-link issue concerns.
/// </summary>
public enum TaxonomyEntityKind
{
    /// <summary>A competition slug (e.g. <c>csmo</c>).</summary>
    Competition,

    /// <summary>A category slug (e.g. <c>a</c>).</summary>
    Category,

    /// <summary>A round, referenced as the (competition, category, round) composite.</summary>
    Round
}

/// <summary>
/// One taxonomy slug that a draft references but the registry doesn't fully back: it's either absent from the
/// structural backbone (<see cref="ResourcePaths.SharedMetadataFileName"/>) or missing a localized name in one
/// or more locale files.
/// A slug must be present in both for it to render in production, so either gap is a preflight failure.
/// </summary>
/// <param name="EntityKind">Which kind of slug this is.</param>
/// <param name="Identifier">The slug, or for a round the composite description (e.g. <c>csmo-a-iii</c>).</param>
/// <param name="MissingFromSharedStructure">True when the slug has no structural entry in
/// <see cref="ResourcePaths.SharedMetadataFileName"/>.</param>
/// <param name="MissingLocales">Locales whose <c>metadata.{locale}.json</c> carries no localized name for the
/// slug.</param>
public record TaxonomyRegistryIssue(
    TaxonomyEntityKind EntityKind,
    string Identifier,
    bool MissingFromSharedStructure,
    ImmutableArray<Language> MissingLocales);
