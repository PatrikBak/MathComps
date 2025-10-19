using MathComps.Cli.SkmoScraper.Dtos;

namespace MathComps.Cli.SkmoScraper.Services;

/// <summary>
/// Service for managing SKMO solution links in the database.
/// Provides methods to find and update problems with solution links from scraped data.
/// </summary>
public interface ISkmoDatabaseService
{
    /// <summary>
    /// Finds problems that match the specified criteria and updates their solution links.
    /// </summary>
    /// <param name="seasonYear">The competition year (e.g., 70, 71).</param>
    /// <param name="competitionSlug">The competition slug (e.g., "csmo", "imo").</param>
    /// <param name="categorySlug">The category slug (e.g., "a", "b", "c"). Can be null for non-categorized competitions.</param>
    /// <param name="roundSlug">The round slug (e.g., "i", "ii", "iii"). Can be null for competitions without rounds.</param>
    /// <param name="solutionLink">The solution link to set for matching problems.</param>
    /// <returns>A result containing the number of problems updated and total problems found.</returns>
    Task<UpdateResult> UpdateProblemsWithSolutionLinkAsync(
        int seasonYear,
        string competitionSlug,
        string? categorySlug,
        string? roundSlug,
        string solutionLink);
}
