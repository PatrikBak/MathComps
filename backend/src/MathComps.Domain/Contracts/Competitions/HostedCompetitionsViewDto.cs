namespace MathComps.Domain.Contracts.Competitions;

/// <summary>
/// The hosted competition program: every group, with the competitions under each.
/// </summary>
/// <param name="Groups">Every group the program has run, is running, or has announced.</param>
public record HostedCompetitionsViewDto(IReadOnlyList<HostedGroupDto> Groups);
