namespace MathComps.Domain.Contracts.Defense;

/// <summary>
/// A full defense conversation about one problem, as returned to the client.
/// </summary>
/// <param name="Id">The session's identifier.</param>
/// <param name="Target"><inheritdoc cref="HandoutEnvironmentTarget" path="/summary"/></param>
/// <param name="Turns">The conversation's turns, in order.</param>
public record DefenseSessionDto(Guid Id, HandoutEnvironmentTarget Target, IReadOnlyList<DefenseTurnDto> Turns);
