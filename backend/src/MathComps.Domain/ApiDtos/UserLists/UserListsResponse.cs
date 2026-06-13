using System.Collections.Immutable;

namespace MathComps.Domain.ApiDtos.UserLists;

/// <summary>
/// Combined response for the lists dropdown, bundling the liked count with user-created lists.
/// </summary>
/// <param name="LikedCount">Number of problems the user has liked (from ProblemLike).</param>
/// <param name="Lists">User-created lists with their metadata, ordered by sort order.</param>
public record UserListsResponse(
    int LikedCount,
    ImmutableList<UserListDto> Lists
);
