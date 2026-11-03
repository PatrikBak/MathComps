using MathComps.Domain.EfCoreEntities;

namespace MathComps.Domain.Contracts.Comments;

/// <summary>
/// Request to press one of the reactions on a comment.
/// </summary>
/// <param name="Kind">The reaction pressed, null when the request sent null.</param>
public record PressCommentReactionRequest(CommentReactionKind? Kind);
