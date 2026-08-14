using System.Collections.Immutable;

namespace MathComps.Domain.Contracts.SearchBar;

/// <summary>
/// A single season with its available competitions.
/// </summary>
/// <param name="EditionNumber">The edition number of the season (e.g. 75. ročník).</param>
/// <param name="EditionLabel">The edition label of the season (e.g. 2024/2025).</param>
/// <param name="Competitions">The competitions available in the season.</param>
public record SeasonCompetitionsGroup(
    int EditionNumber,
    string EditionLabel,
    ImmutableList<CompetitionWithCount> Competitions
);
