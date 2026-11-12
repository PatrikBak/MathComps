using MathComps.Domain.Contracts.Defense;
using Microsoft.Extensions.Logging;

namespace MathComps.Infrastructure.Services.Defense;

/// <summary>
/// Says whether a student may argue what a defense target names, and whether they are competing on it.
/// </summary>
public interface IDefenseTargetGuard
{
    /// <summary>
    /// Throws unless the student may argue the target.
    /// </summary>
    /// <param name="userId">The student asking.</param>
    /// <param name="target">What they want to argue.</param>
    /// <param name="cancellationToken">A token to cancel the work.</param>
    /// <returns>A task that completes once the student is cleared.</returns>
    Task EnsureCanDefendAsync(Guid userId, DefenseTarget target, CancellationToken cancellationToken = default);

    /// <summary>
    /// Says whether the student is competing on the target right now: their clock in the round it is set in is
    /// running, in a group that closes. Settles nothing about whether they may argue it.
    /// </summary>
    /// <param name="userId">The student.</param>
    /// <param name="target">What they argue.</param>
    /// <param name="cancellationToken">A token to cancel the work.</param>
    /// <returns>Whether they are competing; false for a handout, which nobody enters.</returns>
    Task<bool> IsCompetingAsync(Guid userId, DefenseTarget target, CancellationToken cancellationToken = default);
}

/// <summary>
/// Thrown when a problem is not one the caller may reach: no hosted round sets it, or it sits among the proposals
/// out of their reach.
/// </summary>
public sealed class HostedProblemNotFoundException()
    : MathCompsException(
        "Competition problem not found",
        RefusalKind.NotFound,
        LogLevel.Information);
