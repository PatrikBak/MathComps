namespace MathComps.Domain.ApiDtos.SearchBar;

/// <summary>
/// Enhanced contest selection that captures full hierarchical context
/// </summary>
/// <param name="CompetitionSlug">Competition identifier</param>
/// <param name="CategorySlug">Category identifier (null for competition-level or direct rounds)</param>
/// <param name="RoundSlug">Round identifier (null for competition/category level selections)</param>
public record ContestSelection(
    string CompetitionSlug,
    string? CategorySlug,
    string? RoundSlug
);
