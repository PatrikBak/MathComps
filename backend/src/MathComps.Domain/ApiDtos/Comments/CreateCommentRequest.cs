using MathComps.Domain.EfCoreEntities;

namespace MathComps.Domain.ApiDtos.Comments;

/// <summary>
/// Request to create a new comment.
/// </summary>
/// <param name="Target">The target of the comment.</param>
/// <param name="ParentCommentId"><inheritdoc cref="Comment.ParentCommentId" path="/summary"/></param>
/// <param name="Content"><inheritdoc cref="Comment.Content" path="/summary"/></param>
public record CreateCommentRequest(
    CommentTarget Target,
    Guid? ParentCommentId,
    string Content
);
