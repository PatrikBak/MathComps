namespace MathComps.Infrastructure.Services.Comments;

/// <summary>
/// A signed-in user asking the comment service for something, which decides the threads they may reach.
/// </summary>
/// <param name="UserId">The user's internal id.</param>
/// <param name="IsAdmin">Whether the user is an admin.</param>
public sealed record CommentViewer(Guid UserId, bool IsAdmin);
