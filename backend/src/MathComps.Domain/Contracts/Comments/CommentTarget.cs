namespace MathComps.Domain.Contracts.Comments;

/// <summary>
/// The target that a comment is / will be made on.
/// </summary>
/// <param name="TargetType">The type of target.</param>
/// <param name="TargetId">Identifier of the target (might be a slug or some other identifier).</param>
public record CommentTarget(
    CommentTargetType TargetType,
    string TargetId
);
