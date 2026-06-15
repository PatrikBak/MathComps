using MathComps.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;

namespace MathComps.Infrastructure.Services.Problems;

/// <summary>
/// Implementation of <see cref="IProblemImageService"/>.
/// </summary>
public class ProblemImageService(IDbContextFactory<MathCompsDbContext> dbContextFactory) : IProblemImageService
{
    /// <inheritdoc/>
    public async Task<Dictionary<string, string>> GetImageMappingAsync(Guid problemId)
    {
        // Get DB access
        await using var context = await dbContextFactory.CreateDbContextAsync();

        // Query image mappings for this problem
        var mappings = await context.ProblemImages
            .Where(image => image.ProblemId == problemId)
            .Select(image => new { image.OriginalId, image.ContentId })
            .ToListAsync();

        // Build dictionary (OriginalId -> ContentId)
        return mappings.ToDictionary(data => data.OriginalId, data => data.ContentId);
    }
}

