using MathComps.Domain.Contracts.Users;

namespace MathComps.Domain.Contracts.Admin;

/// <summary>
/// One entrant of a competition being graded.
/// </summary>
/// <param name="User">Who they are.</param>
/// <param name="StartedAt">When their clock started.</param>
/// <param name="FinishedAt"><inheritdoc cref="EfCoreEntities.HostedEntry.FinishedAt" path="/summary"/></param>
/// <param name="FinishedAfterSeconds">
/// The sum, over the competition's problems, of how far into their own clock they last wrote about each one while
/// their entry counted, in seconds.
/// </param>
public record GradingEntrantDto(
    UserIdentityDto User,
    DateTimeOffset StartedAt,
    DateTimeOffset? FinishedAt,
    double FinishedAfterSeconds);
