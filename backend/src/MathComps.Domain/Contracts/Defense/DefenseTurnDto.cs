namespace MathComps.Domain.Contracts.Defense;

/// <summary>
/// One turn of a defense conversation, as returned to the client.
/// </summary>
/// <param name="Role">Who authored the turn: <c>examiner</c> or <c>student</c>.</param>
/// <param name="Content">The turn's text (markdown).</param>
/// <param name="CreatedAt">When the turn was recorded.</param>
public record DefenseTurnDto(string Role, string Content, DateTimeOffset CreatedAt);
