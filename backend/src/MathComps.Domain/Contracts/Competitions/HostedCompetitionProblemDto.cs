using MathComps.Domain.Localization;

namespace MathComps.Domain.Contracts.Competitions;

/// <summary>
/// One problem of a competition's set, as an entrant reads it.
/// </summary>
/// <param name="Id">The problem's identifier.</param>
/// <param name="Position">Where it sits in the set, counting from one.</param>
/// <param name="Statement">The statement as markdown, keyed by the language it is written in.</param>
/// <param name="Solution">
/// The official solution as markdown, keyed by the language it is written in; null while the student is still
/// competing here.
/// </param>
/// <param name="Defenses">The conversations the student has held about it, most recently active first.</param>
/// <param name="SelfAssessment">What the student says about their own solution, or null while they have said nothing.</param>
/// <param name="MaxCommentChars">The longest what they say about it may be, in characters.</param>
public record HostedCompetitionProblemDto(
    Guid Id,
    int Position,
    IReadOnlyDictionary<Language, string> Statement,
    IReadOnlyDictionary<Language, string>? Solution,
    IReadOnlyList<HostedCompetitionDefenseLineDto> Defenses,
    string? SelfAssessment,
    int MaxCommentChars);
