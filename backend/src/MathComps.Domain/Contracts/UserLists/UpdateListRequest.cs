namespace MathComps.Domain.Contracts.UserLists;

/// <summary>
/// Request to update (rename) an existing user problem list.
/// </summary>
/// <param name="Name">New display name for the list.</param>
public record UpdateListRequest(string Name);
