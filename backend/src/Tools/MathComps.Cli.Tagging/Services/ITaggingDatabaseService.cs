using System.Collections.Immutable;
using MathComps.Cli.Tagging.Dtos;

namespace MathComps.Cli.Tagging.Services;

/// <summary>
/// Defines the contract for a service that handles data operations for the tagging tool.
/// This interface uses DTOs to decouple the command layer from data persistence concerns.
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
    /// <param name="skipAlreadyTagged">Whether to exclude problems that already have tags assigned.</param>
    /// <param name="tagSelection">If specified, considers only problems where at least one of these tags has not been considered for the problem yet.</param>
    /// <returns>A list of DTOs containing problem details.</returns>
    Task<List<ProblemDetailsDto>> GetProblemsToTagAsync(int count, bool skipAlreadyTagged, SimpleTagsByCategory? tagSelection);

    /// <summary>
    /// Retrieves problems that have tags requiring manual review for potential vetoing.
    /// This method finds problems with tags that meet specific confidence and goodness-of-fit criteria,
    /// allowing users to review and potentially reject low-quality tag assignments.
    /// </summary>
    /// <param name="count">The maximum number of problems to retrieve for review.</param>
    /// <param name="maxConfidence">The maximum confidence level for tags to be considered for vetoing. Tags with confidence above this threshold are excluded.</param>
    /// <param name="maxGoodnessOfFit">The maximum goodness-of-fit score for tags to be considered for vetoing. Tags with scores above this threshold are excluded.</param>
    /// <param name="tagSelection">Optional array of tag names to filter by. If provided, only problems with at least one of these tags will be returned. If null, all qualifying problems are considered.</param>
    /// <returns>A list of problem details containing the problems and their associated tags that meet the veto criteria.</returns>
    Task<List<ProblemDetailsDto>> GetProblemsToVeto(int count, int maxConfidence, float maxGoodnessOfFit, string[]? tagSelection);

    /// <summary>
    /// Updates the tags for a single problem, replacing any existing tags with the same names.
    /// This method removes existing tag associations that match the provided tag names, then adds the new tags.
    /// </summary>
    /// <param name="problemId">The ID of the problem to update.</param>
    /// <param name="tags">The collection of tags to set for the problem, replacing any existing tags with matching names.</param>
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
    /// <param name="tagsApprovals">A dictionary mapping tag names to their approval status (true for approved, false for vetoed).</param>
    Task VetoTagsForProblemAsync(Guid problemId, ImmutableDictionary<string, bool> tagsApprovals);

    /// <summary>
    /// Retrieves usage counts for all tags, ordered by tag type first, then by usage count, then by name.
    /// </summary>
    /// <returns>A list of tag usage DTOs ordered by tag type, usage count, and name.</returns>
    Task<List<TagUsageDto>> GetAllTagUsageAsync();

    /// <summary>
    /// Removes the specified tags from the database completely, including all associations with problems.
    /// </summary>
    /// <param name="tags">The tags to delete.</param>
    Task RemoveTagsFromAllProblemsAsync(string[] tags);

    /// <summary>
    /// Performs a soft removal of a specific tag association from a single problem by tag name.
    /// The tag association is marked as invalid by setting its goodness of fit to 0, but the association remains in the database.
    /// This prevents the tag from being re-added automatically while preserving the veto decision.
    /// </summary>
    /// <param name="problemId">Database ID of the target problem.</param>
    /// <param name="tagName">Human-readable name of the tag to soft-remove.</param>
    Task RemoveSpecificTagFromProblemAsync(Guid problemId, string tagName);

    /// <summary>
    /// Retrieves all high-quality tags currently associated with a specific problem.
    /// Only returns tags that meet the minimum goodness-of-fit threshold criteria.
    /// </summary>
    /// <param name="problemId">Database ID of the target problem.</param>
    /// <returns>A dictionary containing tag data for each qualifying tag associated with the problem.</returns>
    Task<ImmutableDictionary<string, ProblemTagData>> GetTagsForProblemAsync(Guid problemId);
}
