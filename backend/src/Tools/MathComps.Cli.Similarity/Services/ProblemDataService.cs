using MathComps.Cli.Similarity.Dtos;
using MathComps.Domain.EfCoreEntities;
using MathComps.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;
using System.Collections.Immutable;

namespace MathComps.Cli.Similarity.Services;

/// <summary>
/// Implements problem data retrieval for similarity calculation operations.
/// Provides clean DTO-based interface for accessing problem metadata and similarity calculation data
/// while encapsulating all database operations. Supports efficient pagination and filtering
/// to handle large problem datasets during batch similarity processing.
/// </summary>
/// <param name="databaseContextFactory">Entity Framework context factory for creating database connections to access problem and similarity data.</param>
public class ProblemDataService(IDbContextFactory<MathCompsDbContext> databaseContextFactory) : IProblemDataService
{
    /// <inheritdoc/>
    public async Task<IReadOnlyList<ProblemMetadata>> GetProblemsForSimilarityCalculationAsync(
        int takeCount,
        bool skipAlreadyProcessedProblems,
        CancellationToken cancellationToken = default)
    {
        // Get DB context
        await using var databaseContext = await databaseContextFactory.CreateDbContextAsync(cancellationToken);

        // Start with all problems ordered consistently.
        var problemQuery = databaseContext.Problems.OrderByDefaultProblemSort();

        // Filter out problems that already have similarity relationships when requested.
        if (skipAlreadyProcessedProblems)
            problemQuery = problemQuery.Where(problem => !problem.SimilarProblems.Any());

        // Apply limit and project to lightweight metadata DTOs for memory efficiency.
        return await problemQuery
            .Take(takeCount)
            .Select(problem => new ProblemMetadata(problem.Id, problem.Slug))
            .ToListAsync(cancellationToken);
    }

    /// <inheritdoc/>
    public async Task<ProblemSimilarityData> GetProblemSimilarityDataAsync(
        Guid problemId,
        CancellationToken cancellationToken = default)
    {
        // Get DB access
        await using var databaseContext = await databaseContextFactory.CreateDbContextAsync(cancellationToken);

        // Get the needed problem data
        var data = (await (
            from problem in databaseContext.Problems
            where problem.Id == problemId
            select new
            {
                problem.Id,
                problem.RoundInstance.Round.CompetitionId,
                problem.RoundInstance.Round.CompositeSlug,
                problem.StatementEmbedding,
                problem.SolutionEmbedding,

                // Get tag ids
                TagIds = problem.ProblemTagsAll.AsQueryable()
                    // Only good enough tags
                    .Where(ProblemTag.IsGoodEnoughTag)
                    // Take their ids
                    .Select(problemTag => problemTag.TagId)
                    // As a set
                    .ToImmutableHashSet(),

                // For validation
                HasSolution = problem.Solution != null,
            })
            // At most one problem with this id
            .FirstOrDefaultAsync(cancellationToken))
            // Make sure any
            ?? throw new InvalidOperationException($"No probleem with id = {problemId}");

        // Create the DTO
        return new ProblemSimilarityData(
            data.Id,
            data.TagIds,
            data.CompetitionId,
            data.CompositeSlug,
            // Validate embeddings
            data.StatementEmbedding ?? throw new Exception($"Problem {problemId} doesn't have statement embedding"),
            data.HasSolution ? (data.SolutionEmbedding ?? throw new Exception($"Problm {problemId} doesn't have solution embedding")) : null
        );
    }
}
