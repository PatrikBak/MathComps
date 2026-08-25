namespace MathComps.Domain.Contracts.Competitions;

/// <summary>
/// What spending an entry hands back: the entry itself, and the problems it bought.
/// </summary>
/// <param name="Entry">The entry as it now stands.</param>
/// <param name="Problems">The competition's problems, in the order it sets them.</param>
public record SpentEntryDto(HostedEntryDto Entry, IReadOnlyList<HostedCompetitionProblemDto> Problems);
