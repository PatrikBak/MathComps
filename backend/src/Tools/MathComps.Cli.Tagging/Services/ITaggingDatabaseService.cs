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
    /// <returns>A list of DTOs containing problem details.</returns>
    Task<List<ProblemDetailsDto>> GetProblemsToTagAsync(int count, bool skipAlreadyTagged);

    /// <summary>
    /// Updates the tags for a single problem.
    /// </summary>
    /// <param name="problemId">The ID of the problem to update.</param>
    /// <param name="tags">The collection of new tags for the problem.</param>
    Task UpdateTagsForProblemAsync(Guid problemId, TagCollection tags);

    /// <summary>
    /// Retrieves usage counts for all tags, ordered by usage ascending.
    /// </summary>
    /// <returns>The tag usages in a DTO.</returns>
    Task<List<TagUsageDto>> GetAllTagUsageAsync();

    /// <summary>
    /// Removes the specified tag from the database completely, including all associations with problems.
    /// </summary>
    /// <param name="tagId">The tag to delete.</param>
    Task RemoveTagFromAllProblemsAsync(Guid tagId);

    /// <summary>
    /// Removes a specific tag association from a single problem by tag name.
    /// Provides surgical tag removal without affecting other problems using the same tag.
    /// </summary>
    /// <param name="problemId">Database ID of the target problem.</param>
    /// <param name="tagName">Human-readable name of the tag to remove.</param>
    Task RemoveSpecificTagFromProblemAsync(Guid problemId, string tagName);

    /// <summary>
    /// Retrieves all tags currently associated with a specific problem.
    /// If the problem does not exist, an empty collection is returned.
    /// </summary>
    /// <param name="problemId">Database ID of the target problem.</param>
    /// <returns>Collection of tags organized by type.</returns>
    Task<TagCollection> GetTagsForProblemAsync(Guid problemId);
}
