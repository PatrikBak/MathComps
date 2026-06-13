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
    /// <param name="key">The problem key identifying which problems to update.</param>
    /// <param name="solutionLink">The solution link to set for matching problems.</param>
    /// <returns>A result containing the number of problems updated and total problems found.</returns>
    Task<UpdateResult> UpdateProblemsWithSolutionLinkAsync(ProblemKey key, string? solutionLink);

    /// <summary>
    /// Fetches all existing solution links from the database for comparison.
    /// </summary>
    /// <returns>A dictionary mapping problem keys to their current solution links.</returns>
    Task<Dictionary<ProblemKey, string?>> GetExistingSolutionLinksAsync();
}
