using MathComps.Domain.EfCoreEntities;

namespace MathComps.Domain.Contracts.Defense;

/// <summary>
/// One turn of a defense conversation, as returned to the client.
/// </summary>
/// <param name="Id">The turn's identifier.</param>
/// <param name="Role">Who authored the turn.</param>
/// <param name="Content">The turn's text (markdown).</param>
/// <param name="CreatedAt">When the turn was recorded.</param>
public record DefenseTurnDto(Guid Id, TranscriptRole Role, string Content, DateTimeOffset CreatedAt);
