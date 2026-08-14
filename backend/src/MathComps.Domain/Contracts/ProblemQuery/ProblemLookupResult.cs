namespace MathComps.Domain.Contracts.ProblemQuery;

/// <summary>
/// Result of looking up a problem by slug, containing the metadata needed to construct appropriate search filters.
/// This enables direct problem URLs to be converted into equivalent filter states for the search interface.
/// </summary>
/// <param name="CompetitionSlug">Slug of the competition this problem belongs to.</param>
/// <param name="CategorySlug">Slug of the category this problem belongs to (null unless the round
/// sits under one).</param>
/// <param name="RoundSlug">Slug of the round this problem belongs to (null when it is the whole competition).</param>
/// <param name="ContestPath">
/// The contest this problem sits in, as its <see cref="EfCoreEntities.Competition.Path"/> — which names it
/// whole, where the three slugs above only reach the outermost two levels and the contest itself.
/// </param>
/// <param name="Season">The olympiad edition number this problem belongs to (e.g., 75 for 75th edition).</param>
/// <param name="ProblemNumber">The ordinal number of the problem in the competition.</param>
public record ProblemLookupResult(
    int Season,
    string CompetitionSlug,
    string? CategorySlug,
    string? RoundSlug,
    string ContestPath,
    int ProblemNumber
);
