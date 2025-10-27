using MathComps.Cli.Similarity.Dtos;
using MathComps.Domain.Constants;
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

                // Get tag ids
                TagIds = problem.ProblemTagsAll.AsQueryable()
                    // Only good enough tags
                    .Where(ProblemTag.IsGoodEnoughTag)
                    // Take their ids
                    .Select(problemTag => problemTag.TagId)
                    // As a set
                    .ToImmutableHashSet(),

                // We'll need to know whether to load solution embeddings too
                HasSolution = problem.Texts.Any(text => text.DocumentType == DocumentType.Solution),
            })
            // At most one problem with this id
            .FirstOrDefaultAsync(cancellationToken))
            // Make sure any
            ?? throw new InvalidOperationException($"No problem with id = {problemId}");

        /// Load statement embeddings. Using <see cref="EmbeddingConstants.Types.RetrievalQuery"/>
        /// for we will be using this problem as a query asking 'is this problem similar to source'?
        var statementEmbedding = await databaseContext.ProblemEmbeddings
            .Where(embedding => embedding.ProblemText.ProblemId == problemId
                && embedding.ProblemText.DocumentType == DocumentType.Statement
                && embedding.EmbeddingType == EmbeddingConstants.Types.RetrievalQuery)
            .Select(embedding => embedding.Embedding)
            .FirstOrDefaultAsync(cancellationToken)
            // Let's hope we have the embeddings
            ?? throw new Exception($"Problem {problemId} doesn't have statement embedding");

        // If we have a solution, also load the solution embedding in the similar manner
        var solutionEmbedding = !data.HasSolution ? null :
            await databaseContext.ProblemEmbeddings
                .Where(embedding => embedding.ProblemText.ProblemId == problemId
                    && embedding.ProblemText.DocumentType == DocumentType.Solution
                    && embedding.EmbeddingType == EmbeddingConstants.Types.RetrievalQuery)
                .Select(embedding => embedding.Embedding)
                .FirstOrDefaultAsync(cancellationToken)
                // Let's hope we have the embeddings
                ?? throw new Exception($"Problem {problemId} has solution but doesn't have solution embedding");

        // Create the DTO
        return new ProblemSimilarityData(
            data.Id,
            data.TagIds,
            data.CompetitionId,
            data.CompositeSlug,
            statementEmbedding,
            solutionEmbedding
        );
    }
}
