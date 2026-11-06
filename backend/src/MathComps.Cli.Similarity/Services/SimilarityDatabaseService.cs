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

}
