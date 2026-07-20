using MathComps.Shared.Threading;

namespace MathComps.Infrastructure.Services.Defense;

/// <summary>
/// An in-process <see cref="IDefenseUserTurnGate"/> over a <see cref="KeyedAsyncLock{TKey}"/> keyed by user id.
/// Correct for a single API instance (the deployment today); a horizontally-scaled one would need a distributed lock
/// instead, since two instances share no memory. Retained locks are bounded by the distinct-user count, negligible
/// for this workload.
/// </summary>
public sealed class DefenseUserTurnGate : IDefenseUserTurnGate
{
    /// <summary>
    /// The per-user locks.
    /// </summary>
    private readonly KeyedAsyncLock<Guid> _locks = new();

    /// <inheritdoc/>
    public Task<IDisposable> AcquireAsync(Guid userId, CancellationToken cancellationToken)
        // Serialize on the user's own lock.
        => _locks.AcquireAsync(userId, cancellationToken);
}
