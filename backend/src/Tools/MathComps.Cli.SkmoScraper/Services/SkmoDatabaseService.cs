using MathComps.Cli.SkmoScraper.Dtos;
using MathComps.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;

namespace MathComps.Cli.SkmoScraper.Services;

/// <summary>
/// Service for managing SKMO solution links in the database.
/// Implements the logic to find and update problems with solution links from scraped data.
/// Uses IDbContextFactory to properly manage database connections.
/// </summary>
/// <param name="contextFactory">Provided DB access</param>
public class SkmoDatabaseService(IDbContextFactory<MathCompsDbContext> contextFactory) : ISkmoDatabaseService
{
    /// <inheritdoc/>
    public async Task<UpdateResult> UpdateProblemsWithSolutionLinkAsync(
        int seasonYear,
        string competitionSlug,
        string? categorySlug,
        string? roundSlug,
        string solutionLink)
    {
        // Get DB access
        await using var context = await contextFactory.CreateDbContextAsync();

        // Build the base query...
        var query = context.Problems
            // The season must match
            .Where(problem => problem.RoundInstance.Season.EditionNumber == seasonYear
                // So does the component
                && problem.RoundInstance.Round.Competition.Slug == competitionSlug);

        // If category is specified, filter by category slug
        if (categorySlug is not null)
        {
            // Include it in the filter
            query = query.Where(problem => problem.RoundInstance.Round.Category!.Slug == categorySlug);
        }
        // If no category is specified
        else
        {
            // Only include problems without categories...
            query = query.Where(problem => problem.RoundInstance.Round.Category == null);
        }

        // If round is specified, filter by round slug
        if (roundSlug is not null)
        {
            // Filter by it
            query = query.Where(problem => problem.RoundInstance.Round.Slug == roundSlug);
        }

        // First, count total problems that match the criteria
        var totalProblemsFound = await query.CountAsync();

        // The query will return the number of problems updated
        var problemsUpdated = await query
            // That don't already have the correct solution link
            .Where(problem => problem.SolutionLink != solutionLink)
            // And on those
            .ExecuteUpdateAsync(problem =>
                // Set just the solution link
                problem.SetProperty(entity => entity.SolutionLink, solutionLink));

        // We'd like to return both the number of problems updated and total found
        return new UpdateResult(problemsUpdated, totalProblemsFound);
    }
}
