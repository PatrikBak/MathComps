namespace MathComps.Domain.Contracts.ProblemQuery;

/// <summary>
/// Query parameters for retrieving a page of problems.
/// </summary>
/// <param name="Parameters">The filtering criteria to apply.</param>
/// <param name="PageSize">Requested number of results per page. Limited by server configuration to prevent DoS attacks.</param>
/// <param name="PageNumber">1-based page index to retrieve; values below 1 are clamped to the first page.</param>
/// <param name="FavoritesOnly">Whether to show only problems liked by the user.</param>
/// <param name="ListContentId">Optional ContentId of a user list to filter by.</param>
/// <param name="MarkStatus">Optional mark status filter to show only marked or unmarked problems.</param>
public record FilterQuery(
    FilterParameters Parameters,
    int PageSize,
    int PageNumber,
    bool FavoritesOnly,
    string? ListContentId = null,
    MarkStatusFilter? MarkStatus = null
);
