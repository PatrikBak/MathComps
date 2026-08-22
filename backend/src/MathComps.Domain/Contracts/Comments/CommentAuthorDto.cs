using MathComps.Domain.EfCoreEntities;

namespace MathComps.Domain.Contracts.Comments;

/// <summary>
/// Author information for a comment.
/// </summary>
/// <param name="Id"><inheritdoc cref="User.ExternalId" path="/summary"/></param>
/// <param name="Name">What the site calls the author, which is their username once they have chosen one.</param>
/// <param name="AvatarUrl"><inheritdoc cref="User.AvatarUrl" path="/summary"/></param>
public record CommentAuthorDto(
    string Id,
    string Name,
    string? AvatarUrl
);
