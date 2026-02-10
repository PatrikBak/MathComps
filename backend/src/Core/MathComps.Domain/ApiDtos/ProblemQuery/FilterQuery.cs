namespace MathComps.Domain.ApiDtos.ProblemQuery;

/// <summary>
/// Query parameters for retrieving a page of problems.
/// </summary>
/// <param name="Parameters">Core filtering parameters for database queries.</param>
/// <param name="PageSize">Requested number of results per page. Limited by server configuration to prevent DoS attacks.</param>
/// <param name="PageNumber">1-based page index to retrieve. Must be positive.</param>
/// <param name="FavoritesOnly">Whether to show only problems liked by the user.</param>
/// <param name="ListContentId">Optional ContentId of a user list to filter by.</param>
public record FilterQuery(
    FilterParameters Parameters,
    int PageSize,
    int PageNumber,
    bool FavoritesOnly,
    string? ListContentId = null
);
