namespace MathComps.Domain.Contracts.SearchBar;

/// <summary>
/// Enhanced contest selection that captures full hierarchical context
/// </summary>
/// <param name="CompetitionSlug">Competition identifier</param>
/// <param name="CategorySlug">Category identifier (null for competition-level or direct rounds)</param>
/// <param name="RoundSlug">Round identifier (null for competition/category level selections)</param>
/// <param name="Path">
/// The contest the selection names, as its <see cref="EfCoreEntities.Competition.Path"/>, standing for that
/// contest and everything under it. When it is there it names the contest on its own, at whatever depth it
/// sits, and the three slugs above are not read.
/// </param>
public record ContestSelection(
    string CompetitionSlug,
    string? CategorySlug,
    string? RoundSlug,
    string? Path = null
);
