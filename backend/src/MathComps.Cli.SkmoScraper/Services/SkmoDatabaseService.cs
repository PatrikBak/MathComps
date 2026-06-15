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
    public async Task<Dictionary<ProblemKey, string?>> GetExistingSolutionLinksAsync()
    {
        // Get DB access
        await using var context = await contextFactory.CreateDbContextAsync();

        // Fetch all problems with their hierarchy info, grouped by the key components
        var existingLinks = await context.Problems
            .Select(problem => new
            {
                SeasonYear = problem.RoundInstance.Season.EditionNumber,
                CompetitionSlug = problem.RoundInstance.Round.Competition.Slug,
                CategorySlug = problem.RoundInstance.Round.Category != null
                    ? problem.RoundInstance.Round.Category.Slug
                    : null,
                RoundSlug = problem.RoundInstance.Round.Slug,
                problem.SolutionLink
            })
            .Distinct()
            .ToListAsync();

        // Group by key and take the first solution link (they should all be the same for a given key)
        return existingLinks
            .GroupBy(link => new ProblemKey(link.SeasonYear, link.CompetitionSlug, link.CategorySlug, link.RoundSlug))
            .ToDictionary(
                group => group.Key,
                group => group.First().SolutionLink
            );
    }

    /// <inheritdoc/>
    public async Task<UpdateResult> UpdateProblemsWithSolutionLinkAsync(ProblemKey key, string? solutionLink)
    {
        // Get DB access
        await using var context = await contextFactory.CreateDbContextAsync();

        // Build the base query...
        var query = context.Problems
            // The season must match
            .Where(problem => problem.RoundInstance.Season.EditionNumber == key.SeasonYear
                // So does the component
                && problem.RoundInstance.Round.Competition.Slug == key.CompetitionSlug);

        // Filter by category slug when one is specified, otherwise restrict to problems without a category.
        query = key.CategorySlug is not null
            ? query.Where(problem => problem.RoundInstance.Round.Category!.Slug == key.CategorySlug)
            : query.Where(problem => problem.RoundInstance.Round.Category == null);

        // If round is specified, filter by round slug
        if (key.RoundSlug is not null)
        {
            // Filter by it
            query = query.Where(problem => problem.RoundInstance.Round.Slug == key.RoundSlug);
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
