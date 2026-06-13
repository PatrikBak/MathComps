using MathComps.Domain.ApiDtos.UserLists;
using System.Collections.Immutable;

namespace MathComps.Infrastructure.Services.Users;

/// <summary>
/// Defines the contract for managing user problem lists.
/// </summary>
public interface IUserListService
{
    /// <summary>
    /// Gets all lists for a user (ordered by sort order) along with their liked problem count.
    /// </summary>
    /// <param name="userId">The internal ID of the user.</param>
    /// <returns>The user's lists with metadata and liked count.</returns>
    Task<UserListsResponse> GetListsAsync(Guid userId);

    /// <summary>
    /// Creates a new user problem list with an auto-generated content ID.
    /// </summary>
    /// <param name="userId">The internal ID of the user.</param>
    /// <param name="name">The display name for the new list.</param>
    /// <returns>The created list.</returns>
    Task<UserListDto> CreateListAsync(Guid userId, string name);

    /// <summary>
    /// Renames an existing list.
    /// </summary>
    /// <param name="userId">The internal ID of the user.</param>
    /// <param name="contentId">The content ID of the list.</param>
    /// <param name="newName">The new display name.</param>
    /// <returns>The updated list.</returns>
    Task<UserListDto> UpdateListAsync(Guid userId, string contentId, string newName);

    /// <summary>
    /// Deletes a user list. System default lists cannot be deleted.
    /// </summary>
    /// <param name="userId">The internal ID of the user.</param>
    /// <param name="contentId">The content ID of the list to delete.</param>
    Task DeleteListAsync(Guid userId, string contentId);

    /// <summary>
    /// Reorders all lists for a user. Every content ID must be present exactly once.
    /// </summary>
    /// <param name="userId">The internal ID of the user.</param>
    /// <param name="contentIds">Ordered list of all user list content IDs (first = sort order 1).</param>
    Task ReorderListsAsync(Guid userId, ImmutableList<string> contentIds);

    /// <summary>
    /// Adds a problem to a list. Idempotent — does nothing if already present.
    /// </summary>
    /// <param name="userId">The internal ID of the user.</param>
    /// <param name="contentId">The content ID of the target list.</param>
    /// <param name="problemSlug">The slug of the problem to add.</param>
    Task AddProblemAsync(Guid userId, string contentId, string problemSlug);

    /// <summary>
    /// Removes a problem from a list.
    /// </summary>
    /// <param name="userId">The internal ID of the user.</param>
    /// <param name="contentId">The content ID of the target list.</param>
    /// <param name="problemSlug">The slug of the problem to remove.</param>
    Task RemoveProblemAsync(Guid userId, string contentId, string problemSlug);

    /// <summary>
    /// Enables or disables public sharing for a list.
    /// </summary>
    /// <param name="userId">The internal ID of the user.</param>
    /// <param name="contentId">The content ID of the list.</param>
    /// <param name="enabled">Whether sharing should be enabled.</param>
    /// <returns>The updated list.</returns>
    Task<UserListDto> SetSharingAsync(Guid userId, string contentId, bool enabled);

    /// <summary>
    /// Checks whether a user (or anonymous visitor) can access a list.
    /// </summary>
    /// <param name="userId">The internal ID of the user, or null for anonymous access.</param>
    /// <param name="contentId">The content ID of the list.</param>
    /// <returns>The access result indicating whether the list exists and is accessible.</returns>
    Task<ListAccessResult> CheckListAccessAsync(Guid? userId, string contentId);
}
