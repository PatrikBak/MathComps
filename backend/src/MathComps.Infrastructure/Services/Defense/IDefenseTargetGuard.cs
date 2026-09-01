using MathComps.Domain.Contracts.Defense;

namespace MathComps.Infrastructure.Services.Defense;

/// <summary>
/// Says whether a student may argue what a defense target names.
/// </summary>
public interface IDefenseTargetGuard
{
    /// <summary>
    /// Throws unless the student may argue the target, and says whether they hold an entry into it.
    /// </summary>
    /// <param name="userId">The student asking.</param>
    /// <param name="target">What they want to argue.</param>
    /// <param name="cancellationToken">A token to cancel the work.</param>
    /// <returns>Whether the student has spent an entry into the round the target is set in; false for a
    /// handout, which nobody enters.</returns>
    Task<bool> EnsureCanDefendAsync(
        Guid userId, DefenseTarget target, CancellationToken cancellationToken = default);
}

/// <summary>
/// Thrown when a problem is not one a hosted competition sets, which is the only kind that may be argued.
/// </summary>
public sealed class HostedProblemNotFoundException() : Exception("Competition problem not found");
