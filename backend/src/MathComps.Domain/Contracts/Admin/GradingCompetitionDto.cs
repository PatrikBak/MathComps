using MathComps.Domain.Contracts.Competitions;

namespace MathComps.Domain.Contracts.Admin;

/// <summary>
/// One competition of a group with its graded entrants and their grade on every problem.
/// </summary>
/// <param name="RoundId">The round that is the competition.</param>
/// <param name="Category">Which level it runs at.</param>
/// <param name="Problems">Its problems in order.</param>
/// <param name="Entrants">Everyone graded in it, ordered by username.</param>
/// <param name="Grades">Every entrant's grade on every problem.</param>
public record GradingCompetitionDto(
    Guid RoundId,
    HostedCompetitionCategory Category,
    IReadOnlyList<GradingProblemDto> Problems,
    IReadOnlyList<UserIdentityDto> Entrants,
    IReadOnlyList<GradeSummaryDto> Grades);
