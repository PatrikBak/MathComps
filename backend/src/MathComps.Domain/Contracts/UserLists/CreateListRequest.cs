namespace MathComps.Domain.Contracts.UserLists;

/// <summary>
/// Request to create a new user problem list.
/// </summary>
/// <param name="Name">Display name for the new list.</param>
public record CreateListRequest(string Name);
