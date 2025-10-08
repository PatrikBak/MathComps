using System.Collections.Immutable;
using MathComps.Cli.Tagging.Dtos;
using MathComps.Domain.EfCoreEntities;
using MathComps.Infrastructure.Persistence;
using MathComps.Shared;
using Microsoft.EntityFrameworkCore;
using Spectre.Console;

namespace MathComps.Cli.Tagging.Services;

/// <summary>
/// The concrete implementation of the database service that interacts with the PostgreSQL database.
/// </summary>
/// <param name="dbContextFactory">The factory for creating Entity Framework database contexts.</param>
public class TaggingDatabaseService(IDbContextFactory<MathCompsDbContext> dbContextFactory) : ITaggingDatabaseService
{
    /// <inheritdoc />
    public async Task<List<ProblemDetailsDto>> GetProblemsForTagSuggestionAsync(int count)
    {
        // Create a new database context for this operation to ensure proper disposal and isolation.
        await using var dbContext = await dbContextFactory.CreateDbContextAsync();

        var rows = await dbContext.Problems
            .Where(problem => !string.IsNullOrWhiteSpace(problem.Solution))
            .OrderBy(problem => Guid.NewGuid())
            .Take(count)
            .Select(problem => new
            {
                problem.Id,
                problem.Slug,
                problem.Statement,
                problem.Solution,
                TagsData = problem.ProblemTagsAll.Select(pt => new
                {
                    pt.Tag.Name,
                    pt.Tag.TagType,
                    pt.Justification,
                    pt.GoodnessOfFit,
                    pt.Confidence
                }).ToList()
            })
            .ToListAsync();

        var result = rows.Select(p => new ProblemDetailsDto(
                p.Id,
                p.Slug,
                p.Statement,
                p.Solution,
                p.TagsData.ToImmutableDictionary(
                    t => t.Name,
                    t => new ProblemTagData(t.TagType, t.GoodnessOfFit, t.Justification, t.Confidence)
                )))
            .ToList();

        return result;
    }

    /// <inheritdoc />
    public async Task<List<ProblemDetailsDto>> GetProblemsToTagAsync(int count, bool skipAlreadyTagged, SimpleTagsByCategory tagSelection)
    {
        // Create a new database context for this operation to ensure proper disposal and isolation.
        await using var dbContext = await dbContextFactory.CreateDbContextAsync();

        // Start the query
        var query = dbContext.Problems.AsQueryable();

        // Filter out problems that already have tags if requested.
        // This allows users to efficiently focus on untagged problems only.
        if (skipAlreadyTagged)
            query = query.Where(problem => !problem.ProblemTagsAll.Any(pt => pt.GoodnessOfFit >= 0.5f));

        // Filter out problems for which we have already considered all tags in tagSelection
        if (tagSelection != null)
        {
            var tagSelectionList = tagSelection.ToDict().Keys.ToArray();

            // debug: write the intersection size for each problem
            // var tmpQ = dbContext.Problems
            //     .OrderByDefaultProblemSort()
            //     .Select(p => new
            //     {
            //         Problem = p,
            //         IntersectionSize = p.ProblemTagsAll.Join(
            //         tagSelectionList,
            //         pt => pt.Tag.Name, tag => tag, (pt, tag) => tag).Count()
            //     })
            //     .Take(count);
            // var tmpResult = await tmpQ.ToListAsync();
            // var tmpStr = tmpResult.Select(x => $"{x.Problem.Slug} ({x.IntersectionSize})").ToJoinedString();
            // AnsiConsole.MarkupLine(tmpStr);

            var categoriesCounts = tagSelection.Data.ToImmutableDictionary(kv => kv.Key, kv => kv.Value.Length);
            var targetCountWithSolution = categoriesCounts.Sum(kv => kv.Value);
            var targetCountWithoutSolution = categoriesCounts.Where(kv => kv.Key != TagType.Technique).Sum(kv => kv.Value);

            query = query.Where(p => p.ProblemTagsAll
                .Join(tagSelectionList, pt => pt.Tag.Name, tag => tag, (pt, tag) => tag).Count()
                != (p.Solution != null ? targetCountWithSolution : targetCountWithoutSolution));
        }

        // 1) DB-translatable projection only to scalars/lists
        var rows = await query
            // Order & take are fine
            .OrderByDefaultProblemSort()
            .Take(count)
            // Project to a shape EF can translate
            .Select(problem => new
            {
                problem.Id,
                problem.Slug,
                problem.Statement,
                problem.Solution,
                TagsData = problem.ProblemTagsAll.Select(pt => new
                {
                    pt.Tag.Name,
                    pt.Tag.TagType,
                    pt.Justification,
                    pt.GoodnessOfFit,
                    pt.Confidence
                }).ToList()
            })
            .ToListAsync();

        // 2) In-memory: build your immutable dictionaries and DTOs
        var result = rows.Select(p => new ProblemDetailsDto(
                p.Id,
                p.Slug,
                p.Statement,
                p.Solution,
                p.TagsData.ToImmutableDictionary(
                    t => t.Name,
                    t => new ProblemTagData(t.TagType, t.GoodnessOfFit, t.Justification, t.Confidence)
                )))
            .ToList();

        return result;
    }

    /// <inheritdoc />
    public async Task<List<ProblemDetailsDto>> GetProblemsToVeto(int count, int maxConfidence, float maxGoodnessOfFit, string[]? tagSelection)
    {
        // Create a new database context for this operation to ensure proper disposal and isolation.
        await using var dbContext = await dbContextFactory.CreateDbContextAsync();

        // Start the query
        var query = dbContext.Problems.AsQueryable();
        if (tagSelection != null)
        {
            query = query
                .Where(p => p.ProblemTagsAll
                    .Join(tagSelection, p => p.Tag.Name, tag => tag, (p, tag) => p)
                    .Where(pt => pt.GoodnessOfFit >= 0.5f).Any(pt => pt.Confidence <= maxConfidence && pt.GoodnessOfFit <= maxGoodnessOfFit));
        }
        else
        {
            query = query.Where(p => p.ProblemTagsAll
                .Where(pt => pt.GoodnessOfFit >= 0.5f).Any(pt => pt.Confidence <= maxConfidence && pt.GoodnessOfFit <= maxGoodnessOfFit));
        }

        // 1) DB-translatable projection only to scalars/lists
        var rows = await query
            // Order & take are fine
            .OrderByDefaultProblemSort()
            .Take(count)
            // Project to a shape EF can translate
            .Select(problem => new
            {
                problem.Id,
                problem.Slug,
                problem.Statement,
                problem.Solution,
                TagsData = problem.ProblemTagsAll.Where(pt => pt.GoodnessOfFit >= 0.5f).Select(pt => new
                {
                    pt.Tag.Name,
                    pt.Tag.TagType,
                    pt.Justification,
                    pt.GoodnessOfFit,
                    pt.Confidence
                }).ToList()
            })
            .ToListAsync();

        // 2) In-memory: build your immutable dictionaries and DTOs
        var result = rows.Select(p => new ProblemDetailsDto(
                p.Id,
                p.Slug,
                p.Statement,
                p.Solution,
                p.TagsData.ToImmutableDictionary(
                    t => t.Name,
                    t => new ProblemTagData(t.TagType, t.GoodnessOfFit, t.Justification, t.Confidence)
                )))
            .ToList();

        return result;
    }

    /// <inheritdoc />
    public async Task AddTagsForProblemAsync(Guid problemId, ImmutableDictionary<string, ProblemTagData> tags)
    {
        // Create a new database context for this operation to ensure proper disposal and isolation.
        await using var dbContext = await dbContextFactory.CreateDbContextAsync();

        // Fetch the problem entity that needs tag updates.
        var problemToUpdate = await dbContext.Problems
            .Include(problem => problem.ProblemTagsAll)
            .ThenInclude(pt => pt.Tag)
            .FirstOrDefaultAsync(problem => problem.Id == problemId)
            // If the problem doesn't exist, it's sad
            ?? throw new Exception($"Trying to update tags of non-existing problem: {problemId}");

        // Ensure all required Tag entities exist in the database.
        var tagSlugToTagEntity = await GetOrCreateTagEntitiesAsync(dbContext, tags);
        var existingProblemTags = problemToUpdate.ProblemTagsAll.ToList();
        foreach (var pt in existingProblemTags)
        {
            if (tags.ContainsKey(pt.Tag.Name))
            {
                problemToUpdate.ProblemTagsAll.Remove(pt);
            }
        }

        foreach (var kv in tags)
        {
            var tag = tagSlugToTagEntity[kv.Key.ToSlug()];
            problemToUpdate.ProblemTagsAll.Add(new ProblemTag
            {
                TagId = tag.Id,
                ProblemId = problemToUpdate.Id,
                Justification = kv.Value.GoodnessOfFit >= 0.5f ? kv.Value.Justification : null,
                Confidence = kv.Value.GoodnessOfFit >= 0.5f ? kv.Value.Confidence : null,
                GoodnessOfFit = kv.Value.GoodnessOfFit
            });
        }

        await dbContext.SaveChangesAsync();
    }

    /// <inheritdoc />
    public async Task ClearTagsForProblemAsync(Guid problemId)
    {
        // Create a new database context for this operation to ensure proper disposal and isolation.
        await using var dbContext = await dbContextFactory.CreateDbContextAsync();

        // Fetch the problem entity that needs tag updates.
        var problemToUpdate = await dbContext.Problems
            .Include(problem => problem.ProblemTagsAll)
            .FirstOrDefaultAsync(problem => problem.Id == problemId)
            // If the problem doesn't exist, it's sad
            ?? throw new Exception($"Trying to update tags of non-existing problem: {problemId}");

        problemToUpdate.ProblemTagsAll.Clear();

        await dbContext.SaveChangesAsync();
    }

    /// <inheritdoc />
    public async Task VetoTagsForProblemAsync(Guid problemId, ImmutableDictionary<string, bool> tagsApprovals)
    {
        // Create a new database context for this operation to ensure proper disposal and isolation.
        await using var dbContext = await dbContextFactory.CreateDbContextAsync();

        // Fetch the problem entity that needs tag updates.
        var problemToUpdate = await dbContext.Problems
            .Include(problem => problem.ProblemTagsAll)
            .ThenInclude(pt => pt.Tag)
            .FirstOrDefaultAsync(problem => problem.Id == problemId)
            // If the problem doesn't exist, it's sad
            ?? throw new Exception($"Trying to update tags of non-existing problem: {problemId}");

        var problemTags = problemToUpdate.ProblemTagsAll.Join(tagsApprovals, pt => pt.Tag.Name, kv => kv.Key,
            (pt, tagAppKv) => (pt, tagAppKv.Value)).ToList();
        foreach (var (pt, approved) in problemTags)
        {
            if (approved)
            {
                pt.Confidence += 1;
            }
            else
            {
                pt.GoodnessOfFit = 0;
                pt.Justification = null;
                pt.Confidence = null;
            }
        }

        await dbContext.SaveChangesAsync();
    }

    /// <summary>
    /// Retrieves a dictionary of Tag entities for the given slugs, creating any that do not exist.
    /// </summary>
    /// <param name="dbContext">The database context to use for this operation.</param>
    /// <param name="tagsToCreate">A list of tuples, where each contains the Name and TagType of a tag to find or create.</param>
    /// <returns>A dictionary mapping tag slugs to their tracked EF Core Tag entities.</returns>
    private static async Task<Dictionary<string, Tag>> GetOrCreateTagEntitiesAsync(MathCompsDbContext dbContext, ImmutableDictionary<string, ProblemTagData> tags)
    {
        // Step 1: Extract just the slugs from the input to query the database.
        var tagSlugs = tags.Select(kv => kv.Key.ToSlug()).ToList();

        // Step 2: Query the database to find all tags that already exist with the given slugs.
        var tagSlugToTagEntity = await dbContext.Tags
            .Where(tag => tagSlugs.Contains(tag.Slug))
            .ToDictionaryAsync(tag => tag.Slug, tag => tag);

        // Step 3: Identify which of the requested tags do not already exist in the database.
        var newTagsData = tags.Where(kv => !tagSlugToTagEntity.ContainsKey(kv.Key.ToSlug())).ToList();

        // Step 4: Create new Tag entities in memory for the ones that were not found.
        foreach (var kv in newTagsData)
        {
            // A new Tag entity is instantiated with all the required data provided by the caller.
            var newTag = new Tag
            {
                Name = kv.Key,
                Slug = kv.Key.ToSlug(),
                TagType = kv.Value.TagType,
            };

            // Add the new entity to EF Core's DbContext. It is now in the 'Added' state and will be inserted on SaveChanges.
            dbContext.Tags.Add(newTag);

            // Remember the entity so we can reference it in problems
            tagSlugToTagEntity[kv.Key.ToSlug()] = newTag;
        }

        // Return the dictionary containing both the pre-existing and the newly created tags.
        return tagSlugToTagEntity;
    }

    /// <inheritdoc />
    public async Task<List<TagUsageDto>> GetAllTagUsageAsync()
    {
        // Create a new database context for this operation to ensure proper disposal and isolation.
        await using var dbContext = await dbContextFactory.CreateDbContextAsync();

        // Summarize usage per tag to guide pruning choices.

        // First, get all tags with their basic info including TagType
        var tags = await dbContext.Tags
            .Select(tag => new { tag.Id, tag.Name, tag.Slug, tag.TagType })
            .ToListAsync();

        // Then, get the problem counts for each tag using a separate query
        var problemCounts = await dbContext.Problems
            .SelectMany(problem => problem.ProblemTagsAll.Where(pt => pt.GoodnessOfFit >= 0.5f))
            .GroupBy(problemTag => problemTag.TagId)
            .Select(group => new { TagId = group.Key, Count = group.Count() })
            .ToDictionaryAsync(group => group.TagId, group => group.Count);

        // Combine the data into the final DTOs including TagType
        return [.. tags
            .Select(tag => new TagUsageDto(
                tag.Id,
                tag.Name,
                tag.Slug,
                tag.TagType,
                problemCounts.GetValueOrDefault(tag.Id, 0)
            ))
            // Nicely ordered by TagType first, then usage, then name
            .OrderBy(usage => usage.TagType)
            .ThenBy(usage => usage.ProblemCount)
            .ThenBy(usage => usage.Name),];
    }

    /// <inheritdoc />
    public async Task RemoveTagFromAllProblemsAsync(Guid tagId)
    {
        // Create a new database context for this operation to ensure proper disposal and isolation.
        await using var dbContext = await dbContextFactory.CreateDbContextAsync();

        // Load the tag with its problem associations to handle deletion properly.
        var tag = await dbContext.Tags
            .Include(tag => tag.ProblemTagsAll)
            .FirstAsync(tag => tag.Id == tagId);

        // Clear all associations first to satisfy foreign key constraints.
        tag.ProblemTagsAll.Clear();

        // Remove the tag entity completely from the database.
        dbContext.Tags.Remove(tag);

        // Persist both the association removal and tag deletion
        await dbContext.SaveChangesAsync();
    }

    public async Task RemoveTagsFromAllProblemsAsync(string[] tags)
    {
        // Create a new database context for this operation to ensure proper disposal and isolation.
        await using var dbContext = await dbContextFactory.CreateDbContextAsync();

        // Load the tag with its problem associations to handle deletion properly.
        var tagsToRemove = await dbContext.Tags
            .Include(tag => tag.ProblemTagsAll)
            .Where(tag => tags.Contains(tag.Name))
            .ToListAsync();

        // Clear all associations first to satisfy foreign key constraints.
        foreach (var tag in tagsToRemove)
        {
            tag.ProblemTagsAll.Clear();
            dbContext.Tags.Remove(tag);
        }

        // Persist both the association removal and tag deletion
        await dbContext.SaveChangesAsync();
    }

    /// <inheritdoc />
    public async Task RemoveSpecificTagFromProblemAsync(Guid problemId, string tagName)
    {
        // Create a new database context for this operation to ensure proper disposal and isolation.
        await using var dbContext = await dbContextFactory.CreateDbContextAsync();

        // Load the problem with its current tag associations for modification.
        var problem = await dbContext.Problems
            .Include(problem => problem.ProblemTagsAll)
            .ThenInclude(pt => pt.Tag)
            .FirstOrDefaultAsync(problem => problem.Id == problemId)
            // Make sure its there
            ?? throw new ArgumentException($"Problem with ID {problemId} not found");

        // Find the specific tag to remove by name.
        var problemTagToRemove = problem.ProblemTagsAll.Where(pt => pt.GoodnessOfFit >= 0.5f).FirstOrDefault(pt => pt.Tag.Name == tagName);

        // Only proceed if the tag is actually associated with this problem.
        if (problemTagToRemove != null)
        {
            // Set the problem tag's goodness of fit to 0.
            // We do not remove the association, because that would mean that later TagProblemsCommand
            // could add the tag back.

            problemTagToRemove.GoodnessOfFit = 0;
            problemTagToRemove.Justification = null;
            problemTagToRemove.Confidence = null;

            // Persist the association removal to the database.
            await dbContext.SaveChangesAsync();
        }
    }

    /// <inheritdoc />
    public async Task<ImmutableDictionary<string, ProblemTagData>> GetTagsForProblemAsync(Guid problemId)
    {
        // Create a new database context for this operation to ensure proper disposal and isolation.
        await using var dbContext = await dbContextFactory.CreateDbContextAsync();

        var tags = await dbContext.Problems
            .Where(problem => problem.Id == problemId)
            .SelectMany(problem => problem.ProblemTagsAll.Where(pt => pt.GoodnessOfFit >= 0.5f))
            .Include(pt => pt.Tag)
            .ToDictionaryAsync(pt => pt.Tag.Name, pt => new ProblemTagData(pt.Tag.TagType, pt.GoodnessOfFit, pt.Justification, pt.Confidence));

        return tags.ToImmutableDictionary();
    }
}
