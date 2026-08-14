using MathComps.Domain.Contracts.ProblemQuery;
using MathComps.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;

namespace MathComps.Infrastructure.Services.Problems;

/// <summary>
/// Implements problem lookup operations using Entity Framework Core.
/// Provides efficient database queries for common problem identification and retrieval needs
/// across CLI tools and other services that need to resolve problem slugs to database entities.
/// </summary>
/// <param name="dbContextFactory">Entity Framework context factory for creating database connections.</param>
public class ProblemLookupService(IDbContextFactory<MathCompsDbContext> dbContextFactory) : IProblemLookupService
{
    /// <inheritdoc />
    public async Task<Guid?> GetProblemIdBySlugAsync(string problemSlug, CancellationToken cancellationToken = default)
    {
        // Normalize slug to lowercase for consistent database lookups
        problemSlug = problemSlug.ToLowerInvariant();

        // Create isolated database context for this lookup operation
        await using var dbContext = await dbContextFactory.CreateDbContextAsync(cancellationToken);

        // Get the problem's id
        return await dbContext.Problems
            .Where(problem => problem.Slug == problemSlug)
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

        // Query for the season, the competition the problem sits in, and its number
        var problem = await dbContext.Problems
            .Where(candidate => candidate.Slug == problemSlug)
            .Select(candidate => new
            {
                candidate.Round.Season.EditionNumber,
                candidate.Round.Competition.Path,
                candidate.Number,
            })
            .FirstOrDefaultAsync(cancellationToken);

        // Nothing carries that slug
        if (problem is null)
            return null;

        // The season, the competition as the path naming it whole, and the number
        return new ProblemLookupResult(problem.EditionNumber, problem.Path, problem.Number);
    }
}
