using MathComps.Cli.Tagging.Dtos;
using MathComps.Domain.EfCoreEntities;
using MathComps.Infrastructure.Persistence;
using MathComps.Shared;
using Microsoft.EntityFrameworkCore;
using Spectre.Console;
using System.Collections.Immutable;
using System.Linq.Expressions;

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
        // Get DB access
        await using var dbContext = await dbContextFactory.CreateDbContextAsync();

        // Query problems...
        return await GetProblemDetails(dbContext.Problems
            // That have a solution
            .Where(problem => !string.IsNullOrWhiteSpace(problem.Solution))
            // In a random order
            .OrderBy(problem => Guid.NewGuid())
            // Take only the requested count
            .Take(count));
    }

    /// <inheritdoc />
    public async Task<List<ProblemDetailsDto>> GetProblemsToTagAsync(int count, bool skipAlreadyTagged, SimpleTagsByCategory? tagSelection)
    {
        // Gain DB access
        await using var dbContext = await dbContextFactory.CreateDbContextAsync();

        // Start building the query for problems that need tagging
        var query = dbContext.Problems.AsQueryable();

        // Filter out problems that already have tags if requested
        // This allows users to efficiently focus on untagged problems only
        if (skipAlreadyTagged)
            query = query.Where(problem => !problem.ProblemTagsAll.AsQueryable().Any(ProblemTag.IsGoodEnoughTag));

        // Filter out problems for which we have already considered all tags in tagSelection
        if (tagSelection != null)
        {
            // Calculate expected tag counts for problems with and without solutions
            var categoriesCounts = tagSelection.Data.ToImmutableDictionary(pair => pair.Key, pair => pair.Value.Length);
            var targetCountWithSolution = categoriesCounts.Sum(pair => pair.Value);
            var targetCountWithoutSolution = categoriesCounts.Where(pair => pair.Key != TagType.Technique).Sum(pair => pair.Value);

            // Flatten the tag selection
            var selectedTags = tagSelection.Data.Values.Flatten().ToList();

            // Filter problems that haven't been fully processed for the selected tags
            query = query.Where(problem =>
                // Compute how many of the selected tags are already associated with the problem
                (from problemTag in problem.ProblemTagsAll
                 join tagName in selectedTags on problemTag.Tag.Name equals tagName
                 select tagName).Count()
                 // Compare against the expected counts based on whether the problem has a solution
                 != (problem.Solution != null ? targetCountWithSolution : targetCountWithoutSolution));
        }

        // Execute the query 
        return await GetProblemDetails(query
            // Order by default problem sort
            .OrderByDefaultProblemSort()
            // Take only the requested count
            .Take(count));
    }

    /// <inheritdoc />
    public async Task<List<ProblemDetailsDto>> GetProblemsToVeto(int count, int maxConfidence, float maxGoodnessOfFit, string[]? tagSelection)
    {
        // Gain DB access
        await using var dbContext = await dbContextFactory.CreateDbContextAsync();

        // Start building the query for problems that need tag vetoing
        var query = dbContext.Problems.AsQueryable();

        // A helper expression to filter problems based on tag criteria
        Expression<Func<ProblemTag, bool>> applyCriteria = problemTag =>
            problemTag.GoodnessOfFit >= ProblemTag.MinimumGoodnessOfFitThreshold &&
            problemTag.GoodnessOfFit <= maxGoodnessOfFit &&
            problemTag.Confidence <= maxConfidence;

        // Apply filtering based on tag selection and confidence/fit thresholds
        query = tagSelection != null
            // Here we only consider problems that have at least one of the selected tags and match the criteria
            ? query.Where(problem =>
                (from problemTag in problem.ProblemTagsAll.AsQueryable().Where(applyCriteria)
                 join tagName in tagSelection on problemTag.Tag.Name equals tagName
                 select problemTag).Any())
            // Here we consider all problems that have any tags matching the criteria
            : query.Where(problem =>
                (from problemTag in problem.ProblemTagsAll.AsQueryable().Where(applyCriteria)
                 select problemTag).Any());

        // Execute the query 
        return await GetProblemDetails(query
            // Order by default problem sort
            .OrderByDefaultProblemSort()
            // Take only the requested count
            .Take(count));
    }

    /// <inheritdoc />
    public async Task AddTagsForProblemAsync(Guid problemId, ImmutableDictionary<string, ProblemTagData> tags)
    {
        // Create a new database context for this operation to ensure proper disposal and isolation
        await using var dbContext = await dbContextFactory.CreateDbContextAsync();

        // Fetch the problem entity that needs tag updates with all related data
        var problemToUpdate = await dbContext.Problems
            .Include(problem => problem.ProblemTagsAll)
            .ThenInclude(problemTag => problemTag.Tag)
            .FirstOrDefaultAsync(problem => problem.Id == problemId)
            // If the problem doesn't exist, throw an exception
            ?? throw new Exception($"Trying to update tags of non-existing problem: {problemId}");

        // Ensure all required Tag entities exist in the database
        var tagSlugToTagEntity = await GetOrCreateTagEntitiesAsync(dbContext,
            // Send just required data
            tags.Select(pair => (pair.Key, pair.Value.TagType)));

        // Remove existing problem tags that are being updated
        foreach (var existingProblemTag in problemToUpdate.ProblemTagsAll.ToList())
            if (tags.ContainsKey(existingProblemTag.Tag.Name))
                problemToUpdate.ProblemTagsAll.Remove(existingProblemTag);

        // Add new problem tags with proper data mapping
        foreach (var pair in tags)
        {
            // Get the tracked Tag entity
            var tag = tagSlugToTagEntity[pair.Key.ToSlug()];

            // Create and add the ProblemTag association
            problemToUpdate.ProblemTagsAll.Add(new ProblemTag
            {
                TagId = tag.Id,
                ProblemId = problemToUpdate.Id,
                GoodnessOfFit = pair.Value.GoodnessOfFit,

                // Only store justification and confidence if goodness of fit is above threshold
                Justification = pair.Value.GoodnessOfFit >= ProblemTag.MinimumGoodnessOfFitThreshold ? pair.Value.Justification : null,
                Confidence = pair.Value.GoodnessOfFit >= ProblemTag.MinimumGoodnessOfFitThreshold ? pair.Value.Confidence : null,
            });
        }

        // Persist changes to the database
        await dbContext.SaveChangesAsync();
    }

    /// <inheritdoc />
    public async Task ClearTagsForProblemAsync(Guid problemId)
    {
        // Create a new database context for this operation to ensure proper disposal and isolation
        await using var dbContext = await dbContextFactory.CreateDbContextAsync();

        // Fetch the problem entity that needs tag updates with all related data
        var problemToUpdate = await dbContext.Problems
            .Include(problem => problem.ProblemTagsAll)
            .FirstOrDefaultAsync(problem => problem.Id == problemId)
            // If the problem doesn't exist, throw an exception
            ?? throw new Exception($"Trying to update tags of non-existing problem: {problemId}");

        // Clear all tag associations for the problem
        problemToUpdate.ProblemTagsAll.Clear();

        // Persist changes to the database
        await dbContext.SaveChangesAsync();
    }

    /// <inheritdoc />
    public async Task VetoTagsForProblemAsync(Guid problemId, ImmutableDictionary<string, bool> tagsApprovals)
    {
        // Create a new database context for this operation to ensure proper disposal and isolation
        await using var dbContext = await dbContextFactory.CreateDbContextAsync();

        // Fetch the problem entity that needs tag updates with all related data
        var problemToUpdate = await dbContext.Problems
            .Include(problem => problem.ProblemTagsAll)
            .ThenInclude(problemTag => problemTag.Tag)
            .FirstOrDefaultAsync(problem => problem.Id == problemId)
            // If the problem doesn't exist, throw an exception
            ?? throw new Exception($"Trying to update tags of non-existing problem: {problemId}");

        // Join problem tags with approval decisions and apply veto logic
        var problemTags = from problemTag in problemToUpdate.ProblemTagsAll
                          join pair in tagsApprovals on problemTag.Tag.Name equals pair.Key
                          select (problemTag, pair.Value);

        // Apply the approval or veto logic
        foreach (var (problemTag, approved) in problemTags)
        {
            // For approved..
            if (approved)
            {
                // Increase confidence for approved tags
                problemTag.Confidence = (problemTag.Confidence ?? 0) + 1;
            }
            // Not approved means they were shit in the first place (hopefully?)
            else
            {
                // Remove vetoed tags by setting goodness of fit to 0
                problemTag.GoodnessOfFit = 0;
                problemTag.Justification = null;
                problemTag.Confidence = null;
            }
        }

        // Persist changes to the database
        await dbContext.SaveChangesAsync();
    }

    /// <inheritdoc />
    public async Task<List<TagUsageDto>> GetAllTagUsageAsync()
    {
        // Create a new database context for this operation to ensure proper disposal and isolation
        await using var dbContext = await dbContextFactory.CreateDbContextAsync();

        // Summarize usage per tag to guide pruning choices

        // First, get all tags with their basic info including TagType
        var tags = await dbContext.Tags
            .Select(tag => new { tag.Id, tag.Name, tag.Slug, tag.TagType })
            .ToListAsync();

        // Then, get the problem counts for each tag using a separate query
        var problemCounts = await dbContext.Problems
            .SelectMany(Problem.GoodTags)
            .GroupBy(problemTag => problemTag.TagId)
            .Select(group => new { TagId = group.Key, Count = group.Count() })
            .ToDictionaryAsync(group => group.TagId, group => group.Count);

        // Combine the data into the final DTOs including TagType
        return [.. tags
            .Select(tag => new TagUsageDto(
                tag.Name,
                tag.Slug,
                tag.TagType,
                problemCounts.GetValueOrDefault(tag.Id, 0)
            ))
            // Nicely ordered by TagType first, then usage, then name
            .OrderBy(pair => pair.TagType)
            .ThenBy(pair => pair.ProblemCount)
            .ThenBy(pair => pair.Name)];
    }

    /// <inheritdoc />
    public async Task RemoveTagsFromAllProblemsAsync(string[] tags)
    {
        // Get DB access
        await using var dbContext = await dbContextFactory.CreateDbContextAsync();

        // Do the delete and trust the cascade delete to clean up associations
        await dbContext.Tags
            .Where(tag => tags.Contains(tag.Name))
            .ExecuteDeleteAsync();
    }

    /// <inheritdoc />
    public async Task RemoveSpecificTagFromProblemAsync(Guid problemId, string tagName)
    {
        // Get DB access
        await using var dbContext = await dbContextFactory.CreateDbContextAsync();

        // Load the problem with its current tag associations for modification
        var problem = await dbContext.Problems
            .Include(problem => problem.ProblemTagsAll)
            .ThenInclude(problemTag => problemTag.Tag)
            .FirstOrDefaultAsync(problem => problem.Id == problemId)
            // Make sure the problem exists
            ?? throw new ArgumentException($"Problem with ID {problemId} not found");

        // Find the specific tag to remove by name
        var problemTagToRemove = problem
            .ProblemTagsAll.AsQueryable()
            .Where(ProblemTag.IsGoodEnoughTag)
            .FirstOrDefault(problemTag => problemTag.Tag.Name == tagName);

        // Only proceed if the tag is actually associated with this problem
        if (problemTagToRemove != null)
        {
            // Set the problem tag's goodness of fit to 0 (soft removal)
            // We do not remove the association, because that would mean that later TagProblemsCommand
            // could add the tag back so we would lose the last word...
            problemTagToRemove.GoodnessOfFit = 0;
            problemTagToRemove.Justification = null;
            problemTagToRemove.Confidence = null;

            // Persist the association removal to the database
            await dbContext.SaveChangesAsync();
        }
    }

    /// <inheritdoc />
    public async Task<ImmutableDictionary<string, ProblemTagData>> GetTagsForProblemAsync(Guid problemId)
    {
        // Create a new database context for this operation to ensure proper disposal and isolation
        await using var dbContext = await dbContextFactory.CreateDbContextAsync();

        // Query for all high-confidence tags associated with the specified problem using LINQ query syntax
        return (await (
            from problem in dbContext.Problems
            from problemTag in problem.ProblemTagsAll.AsQueryable().Where(ProblemTag.IsGoodEnoughTag)
            where problem.Id == problemId
            select KeyValuePair.Create(
                problemTag.Tag.Name,
                new ProblemTagData(
                    problemTag.Tag.TagType,
                    problemTag.GoodnessOfFit,
                    problemTag.Justification,
                    problemTag.Confidence
                )
            ))
            // Execute the query
            .ToListAsync())
            // Run-time conversion to immutable dictionary
            .ToImmutableDictionary();
    }

    /// <summary>
    /// Retrieves a dictionary of Tag entities for the given slugs, creating any that do not exist.
    /// </summary>
    /// <param name="dbContext">The database context to use for this operation.</param>
    /// <param name="tags">A list of tuples, where each contains the Name and TagType of a tag to find or create.</param>
    /// <returns>A dictionary mapping tag slugs to their tracked EF Core Tag entities.</returns>
    private static async Task<Dictionary<string, Tag>> GetOrCreateTagEntitiesAsync(
        MathCompsDbContext dbContext,
        IEnumerable<(string Name, TagType Type)> tags)
    {
        //  Extract just the slugs from the input to query the database
        var tagSlugs = tags.Select(pair => pair.Name.ToSlug()).ToList();

        // Query the database to find all tags that already exist with the given slugs
        var tagSlugToTagEntity = await dbContext.Tags
            .Where(tag => tagSlugs.Contains(tag.Slug))
            .ToDictionaryAsync(tag => tag.Slug, tag => tag);

        // Identify which of the requested tags do not already exist in the database
        var newTagsData = tags.Where(pair => !tagSlugToTagEntity.ContainsKey(pair.Name.ToSlug())).ToList();

        // Create new Tag entities in memory for the ones that were not found
        foreach (var pair in newTagsData)
        {
            // A new Tag entity is instantiated with all the required data provided by the caller
            var newTag = new Tag
            {
                Name = pair.Name,
                Slug = pair.Name.ToSlug(),
                TagType = pair.Type,
            };

            // Add the new entity to EF Core's DbContext. It is now in the 'Added' state and will be inserted on SaveChanges
            dbContext.Tags.Add(newTag);

            // Remember the entity so we can reference it in problems
            tagSlugToTagEntity[pair.Name.ToSlug()] = newTag;
        }

        // Return the dictionary containing both the pre-existing and the newly created tags
        return tagSlugToTagEntity;
    }

    /// <summary>
    /// A helper to translate problem query results to DTOs
    /// </summary>
    /// <param name="problems">The problem query</param>
    /// <returns>The list of problem DTOs.</returns>
    private static async Task<List<ProblemDetailsDto>> GetProblemDetails(IQueryable<Problem> problems)
        // Project to a shape EF can translate
        => [..(await problems.Select(problem => new
             {
                 problem.Id,
                 problem.Slug,
                 problem.Statement,
                 problem.Solution,
                 TagsData = problem.ProblemTagsAll.Select(problemTag => new
                 {
                     problemTag.Tag.Name,
                     problemTag.Tag.TagType,
                     problemTag.Justification,
                     problemTag.GoodnessOfFit,
                     problemTag.Confidence
                 })
                .ToList()
             })
            // Execute the query
            .ToListAsync())
            // Project to the requested shape
            .Select(problem => new ProblemDetailsDto(
                problem.Id,
                problem.Slug,
                problem.Statement,
                problem.Solution,
                problem.TagsData.ToImmutableDictionary(
                    tagData => tagData.Name,
                    tagData => new ProblemTagData(
                        tagData.TagType,
                        tagData.GoodnessOfFit,
                        tagData.Justification,
                        tagData.Confidence
                    )
                ))
            )];
}
