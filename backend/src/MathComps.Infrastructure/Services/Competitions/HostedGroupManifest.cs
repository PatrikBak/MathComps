using MathComps.Domain.EfCoreEntities;

namespace MathComps.Infrastructure.Services.Competitions;

/// <summary>
/// A hosted group as its manifest describes it: when it is open, how long its clock is, how many problems it sets,
/// and which rounds it runs. A round it names may hold nothing yet, the problems landing through their own drafts
/// later.
/// </summary>
/// <param name="Slug"><inheritdoc cref="HostedGroup.Slug" path="/summary"/></param>
/// <param name="OpensAt"><inheritdoc cref="HostedGroup.OpensAt" path="/summary"/></param>
/// <param name="ClosesAt"><inheritdoc cref="HostedGroup.ClosesAt" path="/summary"/></param>
/// <param name="ClockMinutes"><inheritdoc cref="HostedGroup.ClockMinutes" path="/summary"/></param>
/// <param name="AllowsReentry"><inheritdoc cref="HostedGroup.AllowsReentry" path="/summary"/></param>
/// <param name="ProblemCount"><inheritdoc cref="HostedGroup.ProblemCount" path="/summary"/></param>
/// <param name="Rounds">The rounds it runs, one per category.</param>
public record HostedGroupManifest(
    string Slug,
    DateTimeOffset OpensAt,
    DateTimeOffset? ClosesAt,
    int ClockMinutes,
    bool AllowsReentry,
    int ProblemCount,
    IReadOnlyList<HostedGroupRoundRef> Rounds);

/// <summary>
/// Names one of the rounds a group runs, one already imported. Its problems may still be on their way: a round
/// stands empty from the moment its draft raises it until the ones it will ask are picked.
/// </summary>
/// <param name="CompetitionPath">The path of the node the round hangs off (e.g. <c>mc-advanced-3</c>).</param>
/// <param name="SeasonYear">The calendar year the round's season starts in.</param>
public record HostedGroupRoundRef(string CompetitionPath, int SeasonYear);
