using MathComps.Domain.EfCoreEntities;

namespace MathComps.Domain.Contracts.Comments;

/// <summary>
/// Author information for a comment.
/// </summary>
/// <param name="Id"><inheritdoc cref="User.ExternalId" path="/summary"/></param>
/// <param name="Name">
/// The author's username (<see cref="User.Username"/>), or null when they have chosen none or their account
/// is deleted.
/// </param>
/// <param name="AvatarUrl"><inheritdoc cref="User.AvatarUrl" path="/summary"/></param>
public record CommentAuthorDto(
    string Id,
    string? Name,
    string? AvatarUrl
);
