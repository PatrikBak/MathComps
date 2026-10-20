using MathComps.Domain.Localization;

namespace MathComps.Domain.Contracts.Admin;

/// <summary>
/// Everything grading one group starts from: which group it is, the terms its entries run on, and each of its
/// competitions with its entrants' grades.
/// </summary>
/// <param name="Name">The group's name, keyed by the language it is written in.</param>
/// <param name="OpensAt"><inheritdoc cref="EfCoreEntities.HostedGroup.OpensAt" path="/summary"/></param>
/// <param name="ClosesAt">When the group stops taking entries.</param>
/// <param name="ClockMinutes"><inheritdoc cref="EfCoreEntities.HostedGroup.ClockMinutes" path="/summary"/></param>
/// <param name="NoteGraceMinutes">
/// <inheritdoc cref="Competitions.HostedCompetitionsViewDto" path="/param[@name='NoteGraceMinutes']"/>
/// </param>
/// <param name="Competitions">Its competitions, in the order the taxonomy sets the categories out.</param>
public record GradingBoardDto(
    IReadOnlyDictionary<Language, string> Name,
    DateTimeOffset OpensAt,
    DateTimeOffset ClosesAt,
    int ClockMinutes,
    int NoteGraceMinutes,
    IReadOnlyList<GradingCompetitionDto> Competitions);
