using MathComps.Cli.Embeddings.Dtos;
using MathComps.Domain.EfCoreEntities;
using MathComps.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;
using Pgvector;

namespace MathComps.Cli.Embeddings.Services;

/// <summary>
/// Implementation of database operations for embeddings.
/// </summary>
/// <param name="dbContextFactory">Factory for creating database contexts.</param>
public class EmbeddingDatabaseService(IDbContextFactory<MathCompsDbContext> dbContextFactory) : IEmbeddingDatabaseService
{
    /// <inheritdoc/>
    public async Task<List<ProblemForEmbeddingDto>> GetProblemsNeedingEmbeddingsAsync(int limit, bool forceRegenerate)
    {
        // Get DB access
        await using var context = await dbContextFactory.CreateDbContextAsync();

        // Start with nicely sorted problems
        var query = context.Problems.OrderByDefaultProblemSort();

        // If not forcing regeneration, only get problems without embeddings
        if (!forceRegenerate)
            query = query.Where(problem => !problem.Embeddings.Any());

        // Limit the problems
        query = query.Take(limit);

        // Execute the query with a conversion to DTOs
        return await query
            .Select(problem => new ProblemForEmbeddingDto(
                problem.Id,
                problem.Slug,
                problem.Statement,
                problem.Solution
            ))
            .ToListAsync();
    }

    /// <inheritdoc/>
    public async Task SaveEmbeddingsAsync(Guid problemId, IReadOnlyCollection<ProblemEmbeddingUpsertDto> embeddings)
    {
        // Get DB access
        await using var context = await dbContextFactory.CreateDbContextAsync();

        // Load existing embeddings for this problem
        var existingEmbeddings = await context.ProblemEmbeddings
            .Where(embedding => embedding.ProblemId == problemId)
            .ToListAsync();

        // For each new embedding...
        foreach (var newEmbedding in embeddings)
        {
            // Check if it exists...(DocumentType, EmbeddingType, ModelName) should be unique
            var existing = existingEmbeddings.FirstOrDefault(embedding =>
                embedding.DocumentType == newEmbedding.DocumentType &&
                embedding.EmbeddingType == newEmbedding.EmbeddingType &&
                embedding.ModelName == newEmbedding.ModelName);

            // If exists
            if (existing != null)
            {
                // Update properties
                existing.Embedding = new Vector(newEmbedding.Values);
                existing.ModelName = newEmbedding.ModelName;
                existing.EmbeddingType = newEmbedding.EmbeddingType;
                existing.DocumentType = newEmbedding.DocumentType;
                existing.DateUpdated = newEmbedding.DateUpdated;
            }
            // If new
            else
            {
                // Insert
                context.ProblemEmbeddings.Add(new ProblemEmbedding
                {
                    ProblemId = problemId,
                    DocumentType = newEmbedding.DocumentType,
                    EmbeddingType = newEmbedding.EmbeddingType,
                    ModelName = newEmbedding.ModelName,
                    Embedding = new Vector(newEmbedding.Values),
                    DateUpdated = newEmbedding.DateUpdated
                });
            }
        }

        // Save all updated/inserts
        await context.SaveChangesAsync();
    }
}
