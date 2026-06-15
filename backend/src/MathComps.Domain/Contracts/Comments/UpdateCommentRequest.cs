namespace MathComps.Domain.Contracts.Comments;

/// <summary>
/// Request to update a comment's content.
/// </summary>
/// <param name="Target">The target the comment belongs to.</param>
/// <param name="Content">The new markdown content for the comment.</param>
public record UpdateCommentRequest(CommentTarget Target, string Content);
