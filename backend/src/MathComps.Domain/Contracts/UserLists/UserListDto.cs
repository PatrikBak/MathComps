namespace MathComps.Domain.Contracts.UserLists;

/// <summary>
/// A user's problem list with its metadata.
/// </summary>
/// <param name="ContentId">Short, URL-friendly identifier for this list.</param>
/// <param name="Name">Display name of the list.</param>
/// <param name="ProblemCount">Number of problems currently in this list.</param>
/// <param name="IsShared">Whether this list is publicly viewable via its ContentId.</param>
public record UserListDto(
    string ContentId,
    string Name,
    int ProblemCount,
    bool IsShared
);
