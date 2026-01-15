namespace MathComps.Cli.SkmoScraper.Dtos;

/// <summary>
/// Uniquely identifies a group of problems by their competition hierarchy.
/// Used to match scraped solution links to database records.
/// </summary>
/// <param name="SeasonYear">The competition year (e.g., 70, 71).</param>
/// <param name="CompetitionSlug">The competition slug (e.g., "csmo", "imo").</param>
/// <param name="CategorySlug">The category slug (e.g., "a", "b", "c"). Can be null for non-categorized competitions.</param>
/// <param name="RoundSlug">The round slug (e.g., "i", "ii", "iii"). Can be null for competitions without rounds.</param>
public record ProblemKey(
    int SeasonYear,
    string CompetitionSlug,
    string? CategorySlug,
    string? RoundSlug
);
