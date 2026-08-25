using MathComps.Domain.EfCoreEntities;

namespace MathComps.Infrastructure.Services.Competitions;

/// <summary>
/// A hosted group as its manifest describes it: when it is open, how long its clock is, and which rounds it runs.
/// The rounds themselves are ordinary drafts applied the ordinary way; this only says they belong together and on
/// what terms.
/// </summary>
/// <param name="Slug"><inheritdoc cref="HostedGroup.Slug" path="/summary"/></param>
/// <param name="OpensAt"><inheritdoc cref="HostedGroup.OpensAt" path="/summary"/></param>
/// <param name="ClosesAt"><inheritdoc cref="HostedGroup.ClosesAt" path="/summary"/></param>
/// <param name="ClockMinutes"><inheritdoc cref="HostedGroup.ClockMinutes" path="/summary"/></param>
/// <param name="AllowsReentry"><inheritdoc cref="HostedGroup.AllowsReentry" path="/summary"/></param>
/// <param name="Rounds">The rounds it runs, one per category.</param>
public record HostedGroupManifest(
    string Slug,
    DateTimeOffset OpensAt,
    DateTimeOffset? ClosesAt,
    int ClockMinutes,
    bool AllowsReentry,
    IReadOnlyList<HostedGroupRoundRef> Rounds);

/// <summary>
/// Names one of the rounds a group runs, one already imported and carrying its problems.
/// </summary>
/// <param name="CompetitionPath">The path of the node the round hangs off (e.g. <c>mc-advanced-3</c>).</param>
/// <param name="SeasonYear">The calendar year the round's season starts in.</param>
public record HostedGroupRoundRef(string CompetitionPath, int SeasonYear);
