namespace MathComps.Infrastructure.Services.Selection;

/// <summary>
/// Who is asking to reach a defense conversation.
/// </summary>
/// <param name="UserId">Their account.</param>
/// <param name="IsAdmin">Whether they carry the admin role.</param>
public sealed record ConversationViewer(Guid UserId, bool IsAdmin);
