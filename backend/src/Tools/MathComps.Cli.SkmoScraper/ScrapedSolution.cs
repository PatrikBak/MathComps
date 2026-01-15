using System.Text.Json.Serialization;

namespace MathComps.Cli.SkmoScraper;

/// <summary>
/// Represents a single scraped solution link from the SKMO website. Can also
/// represent a missing solution (so we know it is not there even when the comp is)
/// </summary>
/// <param name="Year">The competition year, referred to as 'Ročník' on the website.</param>
/// <param name="CompetitionId">An identifier for the competition, such as 'Krajské kolo' or 'IMO'.</param>
/// <param name="Category">The category of the competition, such as 'A', 'B', or 'Z9'. Can be null (when parsed when the 'bottom table').</param>
/// <param name="SolutionLink">The absolute URL to the solution document.</param>
public record ScrapedSolution(
    int Year,
    string CompetitionId,
    string? Category,
    string? SolutionLink
)
{
    /// <summary>
    /// A nice problem id usable for logging.
    /// </summary>
    [JsonIgnore]
    public string Slug =>
        $"{Year}" +
        $"{(Category == null ? "" : $"-{Category.ToUpperInvariant()}")}" +
        $"{(CompetitionId == null ? "" : $"-{CompetitionId.ToUpperInvariant()}")}";
}
