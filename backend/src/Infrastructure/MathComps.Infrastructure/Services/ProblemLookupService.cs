using MathComps.Domain.ApiDtos.ProblemQuery;
using MathComps.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;

namespace MathComps.Infrastructure.Services;

/// <summary>
/// Implements problem lookup operations using Entity Framework Core.
/// Provides efficient database queries for common problem identification and retrieval needs
/// across CLI tools and other services that need to resolve problem slugs to database entities.
/// </summary>
/// <param name="dbContextFactory">Entity Framework context factory for creating database connections.</param>
public class ProblemLookupService(IDbContextFactory<MathCompsDbContext> dbContextFactory) : IProblemLookupService
{
    /// <inheritdoc />
    public async Task<Guid?> GetProblemIdBySlugAsync(string problemSlug, bool publishedOnly = false, CancellationToken cancellationToken = default)
    {
        // Normalize slug to lowercase for consistent database lookups
        problemSlug = problemSlug.ToLowerInvariant();

        // Create isolated database context for this lookup operation
        await using var dbContext = await dbContextFactory.CreateDbContextAsync(cancellationToken);

        // Query for problem ID only to minimize data transfer and improve performance
        var query = dbContext.Problems.Where(problem => problem.Slug == problemSlug);

        // Public callers restrict to published problems; CLI/admin callers resolve any problem
        if (publishedOnly)
            query = query.Where(problem => problem.IsPublished);

        // Get the problem's id
        return await query
            .Select(problem => (Guid?)problem.Id)
            .FirstOrDefaultAsync(cancellationToken);
    }

    /// <inheritdoc />
    public async Task<ProblemLookupResult?> GetProblemLookupDataAsync(string problemSlug, CancellationToken cancellationToken = default)
    {
        // Normalize slug to lowercase for consistent database lookups
        problemSlug = problemSlug.ToLowerInvariant();

        // Create isolated database context for this lookup operation
        await using var dbContext = await dbContextFactory.CreateDbContextAsync(cancellationToken);

        // Query for problem metadata needed to construct search filters
        // Only published problems are reachable via the public detail page
        return await dbContext.Problems
            .Where(problem => problem.IsPublished && problem.Slug == problemSlug)
            .Select(problem => new ProblemLookupResult(
                problem.RoundInstance.Season.EditionNumber,
                problem.RoundInstance.Round.Competition.Slug,
                problem.RoundInstance.Round.Category!.Slug,
                problem.RoundInstance.Round.Slug,
                problem.Number
            ))
            .FirstOrDefaultAsync(cancellationToken);
    }
}
