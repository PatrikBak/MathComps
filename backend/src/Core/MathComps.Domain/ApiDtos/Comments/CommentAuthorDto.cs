using MathComps.Domain.EfCoreEntities;

namespace MathComps.Domain.ApiDtos.Comments;

/// <summary>
/// Author information for a comment.
/// </summary>
/// <param name="Id"><inheritdoc cref="User.ExternalId" path="/summary"/></param>
/// <param name="Name"><inheritdoc cref="User.DisplayName" path="/summary"/></param>
/// <param name="AvatarUrl"><inheritdoc cref="User.AvatarUrl" path="/summary"/></param>
public record CommentAuthorDto(
    string Id,
    string Name,
    string? AvatarUrl
);
