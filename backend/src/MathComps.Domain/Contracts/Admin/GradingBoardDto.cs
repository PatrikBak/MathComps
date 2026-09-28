using MathComps.Domain.Localization;

namespace MathComps.Domain.Contracts.Admin;

/// <summary>
/// Everything grading one group starts from: which group it is, and each of its competitions with every graded
/// entrant on every problem.
/// </summary>
/// <param name="Name">The group's name, keyed by the language it is written in.</param>
/// <param name="OpensAt"><inheritdoc cref="EfCoreEntities.HostedGroup.OpensAt" path="/summary"/></param>
/// <param name="ClosesAt">When the group stops taking entries.</param>
/// <param name="Competitions">Its competitions, in the order the taxonomy sets the categories out.</param>
public record GradingBoardDto(
    IReadOnlyDictionary<Language, string> Name,
    DateTimeOffset OpensAt,
    DateTimeOffset ClosesAt,
    IReadOnlyList<GradingCompetitionDto> Competitions);
