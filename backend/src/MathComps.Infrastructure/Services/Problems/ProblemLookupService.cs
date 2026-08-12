using MathComps.Domain.Contracts.ProblemQuery;
using MathComps.Domain.Taxonomy;
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

        // Query for the season, the contest the problem sits in, and its number
        var problem = await dbContext.Problems
            .Where(candidate => candidate.Slug == problemSlug)
            .Select(candidate => new
            {
                candidate.RoundInstance.Season.EditionNumber,
                candidate.RoundInstance.Competition.Path,
                candidate.RoundInstance.Competition.SortPath,
                candidate.Number,
            })
            .FirstOrDefaultAsync(cancellationToken);

        // Nothing carries that slug
        if (problem is null)
            return null;

        // Where the contest sits, which decides which levels it names at all
        var levels = ContestLevels.From(problem.Path, problem.SortPath);

        // The season, the contest levels and the number the slug resolves to
        return new ProblemLookupResult(
            problem.EditionNumber,
            levels.Competition.Slug,
            levels.Category?.Slug,
            levels.Round?.Slug,
            problem.Number);
    }
}
