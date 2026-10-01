using MathComps.Domain.EfCoreEntities;

namespace MathComps.Domain.Contracts.Comments;

/// <summary>
/// Request to update a comment's content.
/// </summary>
/// <param name="Content"><inheritdoc cref="Comment.Content" path="/summary"/></param>
public record UpdateCommentRequest(string Content);
