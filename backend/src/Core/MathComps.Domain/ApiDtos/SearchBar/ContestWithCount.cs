namespace MathComps.Domain.ApiDtos.SearchBar;

/// <summary>
/// A flattened contest entry with full display name and problem count.
/// </summary>
/// <param name="CompetitionSlug">The slug of the competition.</param>
/// <param name="CategorySlug">The slug of the category, if the selected competition has categories (e.g. homee rounds have, IMO does not).</param>
/// <param name="RoundSlug">The slug of the round, if the selected category has rounds (e.g. MEMO has (individual &amp; team), IMO does not).</param>
/// <param name="CompetitionName">The display name of the competition.</param>
/// <param name="CategoryName">The display name of the category, if applicable.</param>
/// <param name="RoundName">The display name of the round, if applicable.</param>
/// <param name="ProblemCount">The number of problems in the contest.</param>
public record ContestWithCount(
    string CompetitionSlug,
    string? CategorySlug,
    string? RoundSlug,
    string CompetitionName,
    string? CategoryName,
    string? RoundName,
    int ProblemCount
);
