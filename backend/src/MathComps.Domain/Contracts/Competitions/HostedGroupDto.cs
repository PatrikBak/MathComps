using MathComps.Domain.Localization;

namespace MathComps.Domain.Contracts.Competitions;

/// <summary>
/// The batch of competitions that open and close together, one per category or a single one at no level.
/// </summary>
/// <param name="Id">The group's identifier.</param>
/// <param name="Slug">What addresses the group (e.g. <c>mc-2026-3</c>).</param>
/// <param name="Name">The group's name, keyed by the language it is written in.</param>
/// <param name="Description">
/// What the group's contest is, in a sentence or two, keyed by the language it is written in; null for a group whose
/// node says nothing beyond its name, as the months do.
/// </param>
/// <param name="ProblemCount"><inheritdoc cref="EfCoreEntities.HostedGroup.ProblemCount" path="/summary"/></param>
/// <param name="ClockMinutes"><inheritdoc cref="EfCoreEntities.HostedGroup.ClockMinutes" path="/summary"/></param>
/// <param name="OpensAt">When its competitions start taking entries.</param>
/// <param name="ClosesAt"><inheritdoc cref="EfCoreEntities.HostedGroup.ClosesAt" path="/summary"/></param>
/// <param name="Competitions">Its competitions, in the order the taxonomy sets the categories out.</param>
public record HostedGroupDto(
    Guid Id,
    string Slug,
    IReadOnlyDictionary<Language, string> Name,
    IReadOnlyDictionary<Language, string>? Description,
    int ProblemCount,
    int ClockMinutes,
    DateTimeOffset OpensAt,
    DateTimeOffset? ClosesAt,
    IReadOnlyList<HostedCompetitionDto> Competitions);
