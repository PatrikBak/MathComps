namespace MathComps.Domain.ApiDtos.UserLists;

/// <summary>
/// Possible outcomes of a list access check.
/// </summary>
public enum ListAccessStatus
{
    /// <summary>
    /// The list does not exist.
    /// </summary>
    NotFound,

    /// <summary>
    /// The list exists but the user does not have access.
    /// </summary>
    NoAccess,

    /// <summary>
    /// The user has access to the list.
    /// </summary>
    HasAccess
}
