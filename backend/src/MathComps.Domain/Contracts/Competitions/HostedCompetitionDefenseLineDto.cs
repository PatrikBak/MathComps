namespace MathComps.Domain.Contracts.Competitions;

/// <summary>
/// One conversation a student has held about one problem, enough to choose between them and no more. What was
/// said stays out: the most recent line is usually the examiner's challenge, and it would spoil the problem.
/// </summary>
/// <param name="SessionId">The defense session the conversation belongs to.</param>
/// <param name="StartedAt">When the student opened it.</param>
/// <param name="TurnsSpent">How many turns the student has spent in it.</param>
/// <param name="MaxTurns"><inheritdoc cref="Defense.DefenseLimitsDto.MaxTurnsPerSession" path="/summary"/></param>
public record HostedCompetitionDefenseLineDto(
    Guid SessionId,
    DateTimeOffset StartedAt,
    int TurnsSpent,
    int MaxTurns);
