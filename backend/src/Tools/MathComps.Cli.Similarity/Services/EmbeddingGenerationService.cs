using MathComps.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;

namespace MathComps.Cli.Similarity.Services;

/// <summary>
/// Implementation of the embedding generation service for math problems.
/// Orchestrates the generation of vector embeddings for problem statements and solutions,
/// ensuring all problems have the necessary semantic representations for similarity calculation.
/// Handles database persistence of generated embeddings transparently.
/// </summary>
/// <param name="embeddingService">Service for generating vector embeddings from text content.</param>
/// <param name="dbContextFactory">Factory for creating database contexts to persist embedding data.</param>
public class EmbeddingGenerationService(
    IEmbeddingService embeddingService,
    IDbContextFactory<MathCompsDbContext> dbContextFactory)
    : IEmbeddingGenerationService
{

    /// <inheritdoc/>
    public async Task EnsureDbProblemHasGeneratedEmbeddings(Guid problemId, bool forceRegenerate = false, CancellationToken cancellationToken = default)
    {
        // Gain DB access
        await using var context = await dbContextFactory.CreateDbContextAsync(cancellationToken);

        // Load the problem
        var problem = await context.Problems.FindAsync([problemId], cancellationToken)
            // Ensure it exists
            ?? throw new InvalidOperationException($"Problem with id {problemId} does not exist");

        // Generate statement embedding based on force regeneration setting
        if (forceRegenerate)
        {
            // Force regeneration of statement embedding - always generate regardless of existing value
            problem.StatementEmbedding =
                (await embeddingService.GenerateEmbeddingsAsync([problem.Statement], role: "passage", cancellationToken))[0];
        }
        else
        {
            // Ensure we have statement embedding - only generate if missing
            problem.StatementEmbedding ??=
                (await embeddingService.GenerateEmbeddingsAsync([problem.Statement], role: "passage", cancellationToken))[0];
        }

        // Generate solution embedding based on force regeneration setting
        if (forceRegenerate)
        {
            // Force regeneration of solution embedding if solution exists
            problem.SolutionEmbedding = string.IsNullOrEmpty(problem.Solution) ? null :
                (await embeddingService.GenerateEmbeddingsAsync([problem.Solution], role: "passage", cancellationToken))[0];
        }
        else
        {
            // Ensure we have solution embedding - only generate if missing
            problem.SolutionEmbedding ??=
                 (string.IsNullOrEmpty(problem.Solution) ? null :
                    (await embeddingService.GenerateEmbeddingsAsync([problem.Solution], role: "passage", cancellationToken))[0]);
        }

        // Persist the embeddings to the database.
        await context.SaveChangesAsync(cancellationToken);
    }
}
