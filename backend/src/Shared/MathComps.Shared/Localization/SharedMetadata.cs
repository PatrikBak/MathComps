using System.Collections.Immutable;

namespace MathComps.Shared.Localization;

/// <summary>
/// Language-neutral structure of the competition taxonomy, deserialized from
/// <see cref="ResourcePaths.SharedMetadataFileName"/>: which competitions exist, which carry categories, which
/// rounds each has, and the sort order of all three (encoded as array position).
/// </summary>
/// <param name="Competitions">All competitions, in display order.</param>
/// <param name="Categories">All category slugs, in sort order.</param>
public record SharedMetadata(
    ImmutableArray<SharedCompetition> Competitions,
    ImmutableArray<string> Categories)
{
    /// <summary>
    /// Looks up a competition's structural entry by slug.
    /// </summary>
    /// <param name="slug">The competition slug (e.g. "csmo", "imo").</param>
    /// <returns>The structural entry.</returns>
    /// <exception cref="InvalidOperationException">Thrown when the competition has no structural entry.</exception>
    public SharedCompetition Competition(string slug) =>
        Competitions.FirstOrDefault(competition => competition.Slug == slug)
            ?? throw StructuralOrder.Missing("competition", slug);

    /// <summary>
    /// A competition's sort order — its 1-based position in the taxonomy.
    /// </summary>
    /// <param name="slug">The competition slug (e.g. "csmo", "imo").</param>
    /// <returns>The 1-based sort order.</returns>
    /// <exception cref="InvalidOperationException">Thrown when the competition has no structural entry.</exception>
    public int CompetitionSortOrder(string slug) =>
        StructuralOrder.PositionOrThrow(Competitions, competition => competition.Slug == slug, "competition", slug);

    /// <summary>
    /// A category's sort order — its 1-based position in the global category list.
    /// </summary>
    /// <param name="slug">The category slug (e.g. "a", "z5").</param>
    /// <returns>The 1-based sort order.</returns>
    /// <exception cref="InvalidOperationException">Thrown when the category has no structural entry.</exception>
    public int CategorySortOrder(string slug) =>
        StructuralOrder.PositionOrThrow(Categories, candidate => candidate == slug, "category", slug);
}

/// <summary>
/// Structural entry for a single competition.
/// </summary>
/// <param name="Slug">The competition slug (e.g. "csmo", "imo").</param>
/// <param name="Categories">
/// Category slugs this competition uses, in sort order, or null when the competition has no categories.
/// </param>
/// <param name="Rounds">
/// Round slugs this competition has, in sort order. Empty means the competition has a single default round
/// (the derived <c>IsDefault</c> case), e.g. IMO.
/// </param>
public record SharedCompetition(
    string Slug,
    ImmutableArray<string>? Categories,
    ImmutableArray<string> Rounds)
{
    /// <summary>
    /// Whether this competition carries no explicit rounds — i.e. its single round is the synthetic default
    /// round (the derived <c>IsDefault</c> case, e.g. IMO).
    /// </summary>
    public bool HasDefaultRound => Rounds.IsEmpty;

    /// <summary>
    /// A round's sort order — its 1-based position among this competition's rounds. A default round (no slug,
    /// or a competition with no explicit rounds) sorts first.
    /// </summary>
    /// <param name="roundSlug">The round slug (e.g. "iii"), or null for a default round.</param>
    /// <returns>The 1-based sort order.</returns>
    /// <exception cref="InvalidOperationException">Thrown when the round has no structural entry.</exception>
    public int RoundSortOrder(string? roundSlug)
    {
        // A default round — no slug, or a competition with no explicit rounds — always sorts first.
        if (roundSlug is null || Rounds.IsEmpty)
            return 1;

        // Otherwise the round's position among its competition's rounds is the sort order.
        return StructuralOrder.PositionOrThrow(
            Rounds, candidate => candidate == roundSlug, "round", $"{Slug}/{roundSlug}");
    }
}

/// <summary>
/// Helpers for reading sort order out of the taxonomy's array-position encoding.
/// </summary>
file static class StructuralOrder
{
    /// <summary>
    /// Returns the 1-based position of the first item matching the predicate, throwing when none matches.
    /// </summary>
    /// <typeparam name="T">The array element type.</typeparam>
    /// <param name="items">The ordered array to scan.</param>
    /// <param name="match">The predicate identifying the wanted item.</param>
    /// <param name="entityKind">The kind of entity (e.g. "competition", "round"), for the error message.</param>
    /// <param name="identifier">The slug or composite key being resolved, for the error message.</param>
    /// <returns>The 1-based position.</returns>
    /// <exception cref="InvalidOperationException">Thrown when no item matches.</exception>
    public static int PositionOrThrow<T>(
        ImmutableArray<T> items,
        Func<T, bool> match,
        string entityKind,
        string identifier)
    {
        // Position in the array is the sort order — a hit returns a 1-based order, a miss returns 0.
        var order = items.Select((item, index) => match(item) ? index + 1 : 0).FirstOrDefault(found => found > 0);
        return order > 0 ? order : throw Missing(entityKind, identifier);
    }

    /// <summary>
    /// Creates an exception for a taxonomy slug missing its structural entry in
    /// <see cref="ResourcePaths.SharedMetadataFileName"/>.
    /// </summary>
    /// <param name="entityKind">The kind of entity (e.g. "competition", "round").</param>
    /// <param name="identifier">The slug or composite key that wasn't found.</param>
    /// <returns>An exception describing the gap.</returns>
    public static InvalidOperationException Missing(string entityKind, string identifier) =>
        new($"No structural entry for {entityKind} '{identifier}' in {ResourcePaths.SharedMetadataFileName}.");
}
