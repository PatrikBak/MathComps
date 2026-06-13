using MathComps.Cli.Similarity.Dtos;
using MathComps.Domain.EfCoreEntities;
using MathComps.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;

namespace MathComps.Cli.Similarity.Services;

/// <summary>
/// Database service for similarity operations on math problems.
/// </summary>
/// <param name="dbContextFactory">Factory for creating database contexts.</param>
public class SimilarityDatabaseService(IDbContextFactory<MathCompsDbContext> dbContextFactory) : ISimilarityDatabaseService
{
    /// <inheritdoc/>
    public async Task StoreSimilarityResultsAsync(
        Guid sourceProblemId,
        IReadOnlyList<SimilarityResult> similarityResults,
        CancellationToken cancellationToken = default)
    {
        // Gain DB acess
        await using var context = await dbContextFactory.CreateDbContextAsync(cancellationToken);

        // Remove any existing similarity relationships for the source problem.
        context.ProblemSimilarities.RemoveRange(context.ProblemSimilarities.Where(similarity => similarity.SourceProblemId == sourceProblemId));

        // Create new similarity relationships for all results with automatic JSON serialization.
        // EF Core automatically handles Components serialization/deserialization as JSON.
        context.ProblemSimilarities.AddRange(similarityResults.Select(result => new ProblemSimilarity
        {
            SourceProblemId = sourceProblemId,
            SimilarProblemId = result.TargetProblemId,
            SimilarityScore = result.SimilarityScore,
            Components = result.Components,
        }));

        // Save all changes in a single transaction.
        await context.SaveChangesAsync(cancellationToken);
    }

    /// <inheritdoc/>
    public async Task<bool> HasExistingSimilaritiesAsync(
        Guid problemId,
        CancellationToken cancellationToken = default)
    {
        // Gain DB acess
        await using var databaseContext = await dbContextFactory.CreateDbContextAsync(cancellationToken);

        // Just check for any similarity with the current problem
        return await databaseContext.ProblemSimilarities.AnyAsync(similarity => similarity.SourceProblemId == problemId, cancellationToken);
    }

    /// <inheritdoc/>
    public async Task<IReadOnlyList<SimilarityResult>> GetExistingSimilaritiesAsync(
        Guid problemId,
        CancellationToken cancellationToken = default)
    {
        // Gain DB acess
        await using var databaseContext = await dbContextFactory.CreateDbContextAsync(cancellationToken);

        // Load the similarity relationships from database with automatic JSON deserialization.
        // EF Core automatically handles Components deserialization from JSON.
        return [.. (await databaseContext.ProblemSimilarities
            .AsNoTracking()
            .Where(similarity => similarity.SourceProblemId == problemId)
            .Select(similarity => new
            {
                similarity.SimilarProblemId,
                similarity.SimilarProblem.Slug,
                similarity.SimilarityScore,
                similarity.Components,
            })
            .ToListAsync(cancellationToken))
            // Convert to DTOs with validation
            .Select(data => new SimilarityResult(
                data.SimilarProblemId,
                data.Slug,
                data.SimilarityScore,
                data.Components ?? throw new InvalidOperationException($"Problem {problemId} doesn't have similarity components for similar problem {data.SimilarProblemId}")
            )),];
    }

}
