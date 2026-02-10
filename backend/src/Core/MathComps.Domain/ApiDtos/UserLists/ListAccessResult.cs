namespace MathComps.Domain.ApiDtos.UserLists;

/// <summary>
/// Result of checking whether a user can access a specific list.
/// Contains the access status and, when accessible, the list name.
/// </summary>
/// <param name="Status">The access check outcome.</param>
/// <param name="ListName">The display name of the list. Only populated when <see cref="Status"/> is <see cref="ListAccessStatus.HasAccess"/>.</param>
public record ListAccessResult(ListAccessStatus Status, string? ListName = null);
