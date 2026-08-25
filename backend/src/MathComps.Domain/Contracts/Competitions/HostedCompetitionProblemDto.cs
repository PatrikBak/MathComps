using MathComps.Domain.Localization;

namespace MathComps.Domain.Contracts.Competitions;

/// <summary>
/// One problem of a competition's set, as an entrant reads it.
/// </summary>
/// <param name="Id">The problem's identifier.</param>
/// <param name="Position">Where it sits in the set, counting from one.</param>
/// <param name="Statement">The statement as markdown, keyed by the language it is written in.</param>
/// <param name="Defenses">The conversations the student has held about it, most recently active first.</param>
public record HostedCompetitionProblemDto(
    Guid Id,
    int Position,
    IReadOnlyDictionary<Language, string> Statement,
    IReadOnlyList<HostedCompetitionDefenseLineDto> Defenses);
