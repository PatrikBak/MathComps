using MathComps.Domain.EfCoreEntities;

namespace MathComps.Domain.Contracts.Comments;

/// <summary>
/// Request to create a new comment.
/// </summary>
/// <param name="Target">The target of the comment, null when the request omitted it.</param>
/// <param name="ParentCommentId"><inheritdoc cref="Comment.ParentCommentId" path="/summary"/></param>
/// <param name="Content">The comment's <see cref="Comment.Content"/>, null when the request omitted it.</param>
public record CreateCommentRequest(
    CommentTarget? Target,
    Guid? ParentCommentId,
    string? Content
);
