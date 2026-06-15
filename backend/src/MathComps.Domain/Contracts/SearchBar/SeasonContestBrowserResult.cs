using System.Collections.Immutable;

namespace MathComps.Domain.Contracts.SearchBar;

/// <summary>
/// Result for the contest browser, grouping contests by season with problem counts.
/// </summary>
/// <param name="Seasons">The seasons available in the contest browser, pre-sorted from the most recent to the oldest.</param>
public record SeasonContestBrowserResult(
    ImmutableList<SeasonContestsGroup> Seasons
);
