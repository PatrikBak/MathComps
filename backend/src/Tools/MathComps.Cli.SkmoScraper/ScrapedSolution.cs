namespace MathComps.Cli.SkmoScraper;

/// <summary>
/// Represents a single scraped solution link from the SKMO website.
/// </summary>
/// <param name="Year">The competition year, referred to as 'Ročník' on the website.</param>
/// <param name="CompetitionId">An identifier for the competition, such as 'Krajské kolo' or 'IMO'.</param>
/// <param name="Category">The category of the competition, such as 'A', 'B', or 'Z9'. Can be null (when parsed when the 'bottom table').</param>
/// <param name="SolutionLink">The absolute URL to the solution document.</param>
public record ScrapedSolution(
    int Year,
    string CompetitionId,
    string? Category,
    string SolutionLink
);
