namespace MathComps.Domain.Contracts.Defense;

/// <summary>
/// A full defense conversation about one problem, as returned to the client.
/// </summary>
/// <param name="Id">The session's identifier.</param>
/// <param name="ProblemKey">Stable, source-namespaced key of the problem being defended (e.g. <c>handout:...</c>).</param>
/// <param name="Turns">The conversation's turns, in order.</param>
public record DefenseSessionDto(Guid Id, string ProblemKey, IReadOnlyList<DefenseTurnDto> Turns);
