using MathComps.Domain.EfCoreEntities;

namespace MathComps.Domain.Contracts.Admin;

/// <summary>
/// A request to write a note about a defense conversation.
/// </summary>
/// <param name="SessionId">The conversation to write about, null when the request omitted it.</param>
/// <param name="TurnId">
/// The reply to write against, or null to write against the conversation as a whole. It has to be one of that
/// conversation's own replies.
/// </param>
/// <param name="Content">The note itself (markdown), null when the request omitted it.</param>
/// <param name="Category">Which failure it names, or null to name none.</param>
public record CreateAdminNoteRequest(
    Guid? SessionId, Guid? TurnId, string? Content, DefenseReportCategory? Category);
