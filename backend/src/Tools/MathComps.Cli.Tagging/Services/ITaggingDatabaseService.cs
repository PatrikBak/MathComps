using System.Collections.Immutable;
using MathComps.Cli.Tagging.Dtos;
using MathComps.Domain.EfCoreEntities;

namespace MathComps.Cli.Tagging.Services;

/// <summary>
/// Defines the contract for a service that handles data operations for the tagging tool.
/// </summary>
public interface ITaggingDatabaseService
{
    /// <summary>
    /// Retrieves a random sample of problems that have solutions.
    /// </summary>
    /// <param name="count">The number of problems to retrieve.</param>
    /// <returns>A list of DTOs containing problem details.</returns>
    Task<List<ProblemDetailsDto>> GetProblemsForTagSuggestionAsync(int count);

    /// <summary>
    /// Retrieves a list of problems to be tagged, ordered deterministically.
    /// </summary>
    /// <param name="count">The number of problems to retrieve.</param>
    /// <param name="tagSelection">If specified, considers only problems where at least one of these tags has not been considered for the problem yet.</param>
    /// <returns>A list of DTOs containing problem details.</returns>
    Task<List<ProblemDetailsDto>> GetProblemsToTagAsync(int count, SimpleTagsByCategory? tagSelection);

    /// <summary>
    /// Retrieves problems that have tags requiring manual review for potential vetoing.
    /// This method finds problems with tags that meet specific confidence and goodness-of-fit criteria,
    /// allowing users to review and potentially reject low-quality tag assignments.
    /// </summary>
    /// <param name="count">The maximum number of problems to retrieve for review.</param>
    /// <param name="maxConfidence">The maximum confidence level for tags to be considered for 
    /// vetoing. Tags with confidence above this threshold are excluded.</param>
    /// <param name="maxGoodnessOfFit">The maximum goodness-of-fit score for tags to be considered for 
    /// vetoing. Tags with scores above this threshold are excluded.</param>
    /// <param name="tagSelection">Optional array of tag slugs to filter by. If provided, only 
    /// problems with at least one of these tags will be returned. If null, all qualifying problems are considered.</param>
    /// <returns>A list of problem details containing the problems and their associated tags that meet the veto criteria.</returns>
    Task<List<ProblemDetailsDto>> GetProblemsToVeto(int count, int maxConfidence, float maxGoodnessOfFit, string[]? tagSelection);

    /// <summary>
    /// Updates the tags for a single problem, replacing any existing tags with the same slugs.
    /// </summary>
    /// <param name="problemId">The ID of the problem to update.</param>
    /// <param name="tags">Dictionary mapping tag slugs to tag data. Existing tags with matching slugs are replaced.</param>
    Task AddTagsForProblemAsync(Guid problemId, ImmutableDictionary<string, ProblemTagData> tags);

    /// <summary>
    /// Clears tags for a single problem.
    /// </summary>
    /// <param name="problemId">The ID of the problem to update.</param>
    Task ClearTagsForProblemAsync(Guid problemId);

    /// <summary>
    /// Processes tag approval or veto decisions for a single problem.
    /// Approved tags have their confidence increased, while vetoed tags are marked as invalid by setting their goodness of fit to 0.
    /// </summary>
    /// <param name="problemId">The ID of the problem to update.</param>
    /// <param name="tagsApprovals">Dictionary mapping tag slugs to their approval status (true for approved, false for vetoed).</param>
    Task VetoTagsForProblemAsync(Guid problemId, ImmutableDictionary<string, bool> tagsApprovals);

    /// <summary>
    /// Retrieves usage counts for all tags, ordered by tag type first, then by usage count, then by slug.
    /// </summary>
    /// <returns>A list of tag usage DTOs ordered by tag type, usage count, and slug.</returns>
    Task<List<TagUsageDto>> GetAllTagUsageAsync();

    /// <summary>
    /// Clears all tags from the database. This deletes all <see cref="Tag"/> entities, which automatically
    /// triggers cascade delete for all <see cref="ProblemTag"/> associations.
    /// </summary>
    Task ClearAllTagsAsync();

    /// <summary>
    /// Imports tags for problems in a single transaction. Groups tags by problem slug, looks up problem IDs,
    /// creates or reuses <see cref="Tag"/> entities, and creates <see cref="ProblemTag"/> associations.
    /// </summary>
    /// <param name="tagImports">List of <see cref="TagImportDto"/> objects containing tag import data</param>
    /// <returns><see cref="ImportTagsResult"/> containing import statistics and any skipped problem slugs</returns>
    Task<ImportTagsResult> ImportTagsAsync(List<TagImportDto> tagImports);

    /// <summary>
    /// Removes <see cref="ProblemTag"/> associations for the specified tags, optionally filtering by assigned status.
    /// When <paramref name="onlyAssigned"/> is false, also deletes the <see cref="Tag"/> entities themselves, completely removing the tags from the database.
    /// </summary>
    /// <param name="tagSlugs">The tag slugs to remove associations for.</param>
    /// <param name="onlyAssigned">If true, only removes those that fit <see cref="ProblemTag.IsGoodEnoughTag"/> and keeps Tag entities.
    /// If false, removes all <see cref="ProblemTag"/> entities and also deletes the Tag entities themselves.</param>
    Task RemoveProblemTagsAsync(string[] tagSlugs, bool onlyAssigned);

    /// <summary>
    /// Performs a soft removal of a specific tag association from a single problem by tag slug.
    /// The tag association is marked as invalid by setting its goodness of fit to 0, but the association remains in the database.
    /// This prevents the tag from being re-added automatically while preserving the veto decision.
    /// </summary>
    /// <param name="problemId">Database ID of the target problem.</param>
    /// <param name="tagSlug">Slug of the tag to soft-remove.</param>
    Task RemoveSpecificTagFromProblemAsync(Guid problemId, string tagSlug);

    /// <summary>
    /// Retrieves all tags for which <see cref="ProblemTag.IsGoodEnoughTag"/> is true 
    /// and are associated with a specific problem.
    /// </summary>
    /// <param name="problemId">Database ID of the target problem.</param>
    /// <returns>A dictionary containing tag data for each qualifying tag associated with the problem.</returns>
    Task<ImmutableDictionary<string, ProblemTagData>> GetTagsForProblemAsync(Guid problemId);

    /// <summary>
    /// Merges two tags by replacing all occurrences of <paramref name="tagToDeleteSlug"/> with 
    /// <paramref name="tagToReplaceSlug"/>. For each problem that has the tag to delete, creates
    /// or updates a ProblemTag with the replacement tag using the same metadata (goodness of fit,
    /// justification, confidence), then removes the deleted tag. This operation is performed in a
    /// single database transaction for efficiency.
    /// </summary>
    /// <param name="tagToDeleteSlug">The slug of the tag to be merged and removed.</param>
    /// <param name="tagToReplaceSlug">The slug of the tag that will replace the deleted tag.</param>
    /// <returns>The number of problems that actually had this tag.</returns>
    Task<int> MergeTagsAsync(string tagToDeleteSlug, string tagToReplaceSlug);
}
