using System.Collections.Immutable;

namespace MathComps.Shared.Localization;

/// <summary>
/// Language-neutral structure of the competition taxonomy, deserialized from metadata.shared.json: which
/// competitions exist, which carry categories, which rounds each has, and the sort order of all three
/// (encoded as array position).
/// </summary>
/// <param name="Competitions">All competitions, in display order.</param>
/// <param name="Categories">All category slugs, in sort order.</param>
public record SharedMetadata(
    ImmutableArray<SharedCompetition> Competitions,
    ImmutableArray<string> Categories);

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
    ImmutableArray<string> Rounds);
