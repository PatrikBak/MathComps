using System.Collections.Immutable;
using MathComps.Domain.EfCoreEntities;

namespace MathComps.Domain.Contracts.Comments;

/// <summary>
/// A single comment with nested replies.
/// </summary>
/// <param name="Id"><inheritdoc cref="Comment.Id" path="/summary"/></param>
/// <param name="Author">The comment's author data.</param>
/// <param name="Content"><inheritdoc cref="Comment.Content" path="/summary"/></param>
/// <param name="CreatedAt"><inheritdoc cref="Comment.CreatedAt" path="/summary"/></param>
/// <param name="EditedAt">When the comment was last edited, if applicable.</param>
/// <param name="IsDeleted">Whether the comment has been soft-deleted.</param>
/// <param name="LikeCount">Total number of likes on this comment.</param>
/// <param name="IsLiked">Whether the viewing user has liked this comment. False if there is no user.</param>
/// <param name="Replies">Nested reply comments (recursive).</param>
public record CommentDto(
    Guid Id,
    CommentAuthorDto Author,
    string Content,
    DateTimeOffset CreatedAt,
    DateTimeOffset? EditedAt,
    bool IsDeleted,
    int LikeCount,
    bool IsLiked,
    ImmutableList<CommentDto> Replies
);
