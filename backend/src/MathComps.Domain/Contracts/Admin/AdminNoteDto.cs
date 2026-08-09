using MathComps.Domain.EfCoreEntities;

namespace MathComps.Domain.Contracts.Admin;

/// <summary>
/// One note written while reviewing a defense conversation, as returned to the client.
/// </summary>
/// <param name="Id">The note's identifier.</param>
/// <param name="SessionId">The conversation it is about.</param>
/// <param name="TurnId">The reply it is against, or null when it is against the conversation as a whole.</param>
/// <param name="Author">The reviewer who wrote it.</param>
/// <param name="IsOwn">
/// Whether the reviewer this was read for is the one who wrote it, which is what decides whether it can be
/// revised or dropped.
/// </param>
/// <param name="Content">The note itself (markdown).</param>
/// <param name="Category">Which failure it names, or null when it names none.</param>
/// <param name="ResolvedAt">When it was settled, or null while it still stands.</param>
/// <param name="CreatedAt">When it was written.</param>
/// <param name="UpdatedAt">When it last changed.</param>
public record AdminNoteDto(
    Guid Id,
    Guid SessionId,
    Guid? TurnId,
    AdminDefenseUserDto Author,
    bool IsOwn,
    string Content,
    DefenseReportCategory? Category,
    DateTimeOffset? ResolvedAt,
    DateTimeOffset CreatedAt,
    DateTimeOffset UpdatedAt);
