namespace MathComps.Domain.Contracts.Comments;

/// <summary>
/// Result returned after updating a comment.
/// </summary>
/// <param name="Id">The ID of the newly created comment version.</param>
/// <param name="EditedAt">The timestamp when the edit was made.</param>
public record UpdateCommentResult(Guid Id, DateTimeOffset EditedAt);
