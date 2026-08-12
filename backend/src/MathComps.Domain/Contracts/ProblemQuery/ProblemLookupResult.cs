namespace MathComps.Domain.Contracts.ProblemQuery;

/// <summary>
/// Result of looking up a problem by slug, containing the metadata needed to construct appropriate search filters.
/// This enables direct problem URLs to be converted into equivalent filter states for the search interface.
/// </summary>
/// <param name="CompetitionSlug">Slug of the competition this problem belongs to.</param>
/// <param name="CategorySlug">Slug of the category this problem belongs to (null unless the round
/// sits under one).</param>
/// <param name="RoundSlug">Slug of the round this problem belongs to (null when it is the whole competition).</param>
/// <param name="Season">The olympiad edition number this problem belongs to (e.g., 75 for 75th edition).</param>
/// <param name="ProblemNumber">The ordinal number of the problem in the competition.</param>
public record ProblemLookupResult(
    int Season,
    string CompetitionSlug,
    string? CategorySlug,
    string? RoundSlug,
    int ProblemNumber
);
