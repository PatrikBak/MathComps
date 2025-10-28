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
            query = query.Where(problem => !problem.Texts.SelectMany(t => t.Embeddings).Any());

        // Limit the problems
        query = query.Take(limit);

        // Execute the query with a conversion to DTOs
        return await query
            .Select(problem => new ProblemForEmbeddingDto(
                problem.Id,
                problem.Slug,
                // Get statement text from ProblemTexts (original language)
                problem.Texts
                    .Where(text => text.DocumentType == DocumentType.Statement && text.IsOriginal)
                    .Select(text => text.RawText)
                    .First(),
                // Get solution text from ProblemTexts (original language) if it exists
                problem.Texts
                    .Where(text => text.DocumentType == DocumentType.Solution && text.IsOriginal)
                    .Select(text => text.RawText)
                    .FirstOrDefault()
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
            .Where(embedding => embedding.ProblemText.ProblemId == problemId)
            .ToListAsync();

        // For each new embedding...
        foreach (var newEmbedding in embeddings)
        {
            // Check if it exists...(ProblemTextId, EmbeddingType, ModelName) should be unique
            var existing = existingEmbeddings.FirstOrDefault(embedding =>
                embedding.ProblemText.DocumentType == newEmbedding.DocumentType &&
                embedding.EmbeddingType == newEmbedding.EmbeddingType &&
                embedding.ModelName == newEmbedding.ModelName);

            // If exists
            if (existing != null)
            {
                // Update properties
                existing.Embedding = new Vector(newEmbedding.Values);
                existing.ModelName = newEmbedding.ModelName;
                existing.EmbeddingType = newEmbedding.EmbeddingType;
                existing.DateUpdated = newEmbedding.DateUpdated;
            }
            // If new
            else
            {
                // Find the original problem text id, it must exist because we did the embedding lol
                var problemTextId = await context.ProblemTexts
                    .Where(text => text.ProblemId == problemId && text.DocumentType == newEmbedding.DocumentType && text.IsOriginal)
                    .Select(text => text.Id)
                    .SingleAsync();

                // Insert the embedding
                context.ProblemEmbeddings.Add(new ProblemEmbedding
                {
                    ProblemTextId = problemTextId,
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
