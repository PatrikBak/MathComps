using MathComps.Domain.EfCoreEntities;

namespace MathComps.Domain.Contracts.Comments;

/// <summary>
/// One person's reaction on a comment.
/// </summary>
/// <param name="UserId">The <see cref="User.ExternalId"/> of who pressed it.</param>
/// <param name="Name">
/// The reacting user's username (<see cref="User.Username"/>), or null when they have chosen none or their account
/// is deleted.
/// </param>
/// <param name="Kind"><inheritdoc cref="CommentReaction.Kind" path="/summary"/></param>
public record CommentReactionDto(
    string UserId,
    string? Name,
    CommentReactionKind Kind
);
