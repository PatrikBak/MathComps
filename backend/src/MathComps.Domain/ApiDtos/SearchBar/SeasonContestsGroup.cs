using System.Collections.Immutable;

namespace MathComps.Domain.ApiDtos.SearchBar;

/// <summary>
/// A single season with its available contests.
/// </summary>
/// <param name="EditionNumber">The edition number of the season (e.g. 75. ročník).</param>
/// <param name="EditionLabel">The edition label of the season (e.g. 2024/2025).</param>
/// <param name="Contests">The contests available in the season.</param>
public record SeasonContestsGroup(
    int EditionNumber,
    string EditionLabel,
    ImmutableList<ContestWithCount> Contests
);
