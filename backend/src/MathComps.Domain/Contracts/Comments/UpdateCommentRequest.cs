using MathComps.Domain.EfCoreEntities;

namespace MathComps.Domain.Contracts.Comments;

/// <summary>
/// Request to update a comment's content.
/// </summary>
/// <param name="Content">The comment's new <see cref="Comment.Content"/>, null when the request sent null.</param>
public record UpdateCommentRequest(string? Content);
