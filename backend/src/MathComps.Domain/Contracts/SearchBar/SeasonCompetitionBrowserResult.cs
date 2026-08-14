using System.Collections.Immutable;

namespace MathComps.Domain.Contracts.SearchBar;

/// <summary>
/// Result for the competition browser, grouping competitions by season with problem counts.
/// </summary>
/// <param name="Seasons">The seasons available in the competition browser, pre-sorted from the most recent to
/// the oldest.</param>
public record SeasonCompetitionBrowserResult(
    ImmutableList<SeasonCompetitionsGroup> Seasons
);
