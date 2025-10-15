using MathComps.Cli.Tagging.Dtos;
using MathComps.Domain.EfCoreEntities;
using MathComps.Infrastructure.Persistence;
using MathComps.Shared;
using Microsoft.EntityFrameworkCore;

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

        // For suggesting new tags, it's crucial to have the full context, including the solution.
        // This query selects a random sample of problems that are guaranteed to have a solution.
        return await dbContext.Problems.Where(problem => !string.IsNullOrWhiteSpace(problem.Solution))
            // Random order
            .OrderBy(problem => Guid.NewGuid())
            // Take requested count
            .Take(count)
            // The data is returned as a DTO to decouple the command layer from EF entities.
            .Select(problem => new ProblemDetailsDto(problem.Id, problem.Slug, problem.Statement, problem.Solution))
            // Evaluate
            .ToListAsync();
    }

    /// <inheritdoc />
    public async Task<List<ProblemDetailsDto>> GetProblemsToTagAsync(int count, bool skipAlreadyTagged)
    {
        // Create a new database context for this operation to ensure proper disposal and isolation.
        await using var dbContext = await dbContextFactory.CreateDbContextAsync();

        // Start the query
        var query = dbContext.Problems.AsQueryable();

        // Filter out problems that already have tags if requested.
        // This allows users to efficiently focus on untagged problems only.
        if (skipAlreadyTagged)
            query = query.Where(problem => !problem.Tags.Any());

        // For applying tags, we need a deterministic list of problems.
        return await query
            // Order problems deterministically from the latest
            .OrderByDefaultProblemSort()
            // Take the requested batch
            .Take(count)
            // The data is returned as a DTO, including the solution if it exists.
            .Select(problem => new ProblemDetailsDto(problem.Id, problem.Slug, problem.Statement, problem.Solution))
            // Evaluate
            .ToListAsync();
    }

    /// <inheritdoc />
    public async Task UpdateTagsForProblemAsync(Guid problemId, TagCollection tags)
    {
        // Create a new database context for this operation to ensure proper disposal and isolation.
        await using var dbContext = await dbContextFactory.CreateDbContextAsync();

        // Phase 1: Deconstruct the incoming DTO to create a flat, unique list of all tags required for this update operation.
        // This involves iterating through each tag category and mapping them to a tuple of (Name, Slug, Type).
        var allTags = new List<(string Name, string Slug, TagType Type)>();

        // Process 'Area' tags if they are provided in the collection.
        if (tags.Area != null)
            allTags.AddRange(tags.Area.Select(name => (name, name.ToSlug(), TagType.Area)));

        // Process 'Type' tags similarly.
        if (tags.Type != null)
            allTags.AddRange(tags.Type.Select(name => (name, name.ToSlug(), TagType.Type)));

        // Process 'Technique' tags.
        if (tags.Technique != null)
            allTags.AddRange(tags.Technique.Select(name => (name, name.ToSlug(), TagType.Technique)));

        // De-duplicate the list of tags to prevent trying to create the same new tag multiple times.
        var distinctTags = allTags.DistinctBy(tag => tag.Slug).ToList();

        // Phase 2: Ensure all required Tag entities exist in the database.
        var tagSlugToTagEntity = await GetOrCreateTagEntitiesAsync(dbContext, distinctTags);

        // Phase 3: Fetch the problem entity that needs tag updates.
        var problemToUpdate = await dbContext.Problems
            .Include(problem => problem.Tags)
            .FirstOrDefaultAsync(problem => problem.Id == problemId)
            // If the problem doesn't exist, it's sad
            ?? throw new Exception($"Trying to update tags of non-existing problem: {problemId}");

        // Phase 4: Apply the tag updates to the problem entity in memory.
        // To ensure a clean update, first remove all existing tags from the problem.
        problemToUpdate.Tags.Clear();

        // Get the list of all tag names from the incoming TagCollection DTO.
        var newTagNames = tags.GetAllTags();

        // For each requested tag name, find the corresponding tracked EF entity and add the association.
        foreach (var tag in newTagNames.Select(name => tagSlugToTagEntity[name.ToSlug()]))
            problemToUpdate.Tags.Add(tag);

        // Phase 5: Persist all accumulated changes to the database.
        await dbContext.SaveChangesAsync();
    }

    /// <summary>
    /// Retrieves a dictionary of Tag entities for the given slugs, creating any that do not exist.
    /// </summary>
    /// <param name="dbContext">The database context to use for this operation.</param>
    /// <param name="tagsToCreate">A list of tuples, where each contains the Name and TagType of a tag to find or create.</param>
    /// <returns>A dictionary mapping tag slugs to their tracked EF Core Tag entities.</returns>
    private static async Task<Dictionary<string, Tag>> GetOrCreateTagEntitiesAsync(MathCompsDbContext dbContext, List<(string Name, string Slug, TagType Type)> tagsToCreate)
    {
        // Step 1: Extract just the slugs from the input to query the database.
        var tagSlugs = tagsToCreate.Select(tag => tag.Slug).ToList();

        // Step 2: Query the database to find all tags that already exist with the given slugs.
        var tagSlugToTagEntity = await dbContext.Tags
            .Where(tag => tagSlugs.Contains(tag.Slug))
            .ToDictionaryAsync(tag => tag.Slug, tag => tag);

        // Step 3: Identify which of the requested tags do not already exist in the database.
        var newTagsData = tagsToCreate.Where(tag => !tagSlugToTagEntity.ContainsKey(tag.Slug)).ToList();

        // Step 4: Create new Tag entities in memory for the ones that were not found.
        foreach (var tagData in newTagsData)
        {
            // A new Tag entity is instantiated with all the required data provided by the caller.
            var newTag = new Tag
            {
                Name = tagData.Name,
                Slug = tagData.Slug,
                TagType = tagData.Type,
            };

            // Add the new entity to EF Core's DbContext. It is now in the 'Added' state and will be inserted on SaveChanges.
            dbContext.Tags.Add(newTag);

            // Remember the entity so we can reference it in problems
            tagSlugToTagEntity[tagData.Slug] = newTag;
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
            .SelectMany(problem => problem.Tags)
            .GroupBy(tag => tag.Id)
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
            .Include(tag => tag.Problems)
            .FirstAsync(tag => tag.Id == tagId);

        // Clear all associations first to satisfy foreign key constraints.
        tag.Problems.Clear();

        // Remove the tag entity completely from the database.
        dbContext.Tags.Remove(tag);

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
            .Include(problem => problem.Tags)
            .FirstOrDefaultAsync(problem => problem.Id == problemId)
            // Make sure its there
            ?? throw new ArgumentException($"Problem with ID {problemId} not found");

        // Find the specific tag to remove by name.
        var tagToRemove = problem.Tags.FirstOrDefault(tag => tag.Name == tagName);

        // Only proceed if the tag is actually associated with this problem.
        if (tagToRemove != null)
        {
            // Remove the association between this problem and the tag.
            // The tag entity itself remains in the database for use by other problems.
            problem.Tags.Remove(tagToRemove);

            // Persist the association removal to the database.
            await dbContext.SaveChangesAsync();
        }
    }

    /// <inheritdoc />
    public async Task<TagCollection> GetTagsForProblemAsync(Guid problemId)
    {
        // Create a new database context for this operation to ensure proper disposal and isolation.
        await using var dbContext = await dbContextFactory.CreateDbContextAsync();

        // Query tags directly grouped by type in a single database operation.
        var tagsByType = await dbContext.Problems
            .Where(problem => problem.Id == problemId)
            .SelectMany(problem => problem.Tags)
            .GroupBy(tag => tag.TagType)
            .Select(group => new { TagType = group.Key, Names = group.Select(tag => tag.Name).Order().ToArray() })
            .ToListAsync();

        // Extract sorted arrays for each category, using null for empty categories to match system conventions.
        var areaTags = tagsByType.FirstOrDefault(group => group.TagType == TagType.Area)?.Names;
        var typeTags = tagsByType.FirstOrDefault(group => group.TagType == TagType.Type)?.Names;
        var techniqueTags = tagsByType.FirstOrDefault(group => group.TagType == TagType.Technique)?.Names;

        // Return organized tag collection.
        return new TagCollection(
            Area: areaTags?.Length > 0 ? areaTags : null,
            Type: typeTags?.Length > 0 ? typeTags : null,
            Technique: techniqueTags?.Length > 0 ? techniqueTags : null
        );
    }
}
