namespace MathComps.Domain.Contracts.Defense;

/// <summary>
/// A problem's defense conversations, and the caps a further one is held to. The caps travel with every read,
/// since they are configuration the server can be given a new value for at any time.
/// </summary>
/// <param name="Sessions">The conversations, most recently active first.</param>
/// <param name="Limits"><inheritdoc cref="DefenseLimitsDto" path="/summary"/></param>
public record DefenseSessionListDto(
    IReadOnlyList<DefenseSessionDto> Sessions,
    DefenseLimitsDto Limits);
