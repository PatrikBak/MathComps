using MathComps.Domain.Localization;

namespace MathComps.Domain.Contracts.Competitions;

/// <summary>
/// The batch of competitions that open and close together, one per category.
/// </summary>
/// <param name="Id">The group's identifier.</param>
/// <param name="Name">The group's name, keyed by the language it is written in.</param>
/// <param name="ProblemCount">How many problems each of its competitions holds.</param>
/// <param name="ClockMinutes"><inheritdoc cref="EfCoreEntities.HostedGroup.ClockMinutes" path="/summary"/></param>
/// <param name="OpensAt">When its competitions start taking entries.</param>
/// <param name="ClosesAt"><inheritdoc cref="EfCoreEntities.HostedGroup.ClosesAt" path="/summary"/></param>
/// <param name="Competitions">Its competitions, in the order the taxonomy sets the categories out.</param>
public record HostedGroupDto(
    Guid Id,
    IReadOnlyDictionary<Language, string> Name,
    int ProblemCount,
    int ClockMinutes,
    DateTimeOffset OpensAt,
    DateTimeOffset? ClosesAt,
    IReadOnlyList<HostedCompetitionDto> Competitions);
