namespace MathComps.Domain.Contracts.ProblemQuery;

/// <summary>
/// Result of looking up a problem by slug, containing the metadata needed to construct appropriate search filters.
/// This enables direct problem URLs to be converted into equivalent filter states for the search interface.
/// </summary>
/// <param name="CompetitionPath">
/// The competition this problem sits in, as its <see cref="EfCoreEntities.Competition.Path"/>, which names it
/// whole at whatever depth it sits.
/// </param>
/// <param name="Season">The olympiad edition number this problem belongs to (e.g., 75 for 75th edition).</param>
/// <param name="ProblemNumber">The ordinal number of the problem in the competition.</param>
public record ProblemLookupResult(
    int Season,
    string CompetitionPath,
    int ProblemNumber
);
