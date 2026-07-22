namespace MathComps.Infrastructure.Services.Ai;

/// <summary>
/// A running sum of <see cref="ModelUsage"/> that a unit of work folds each call into as the call lands, so the
/// partial total survives even if the work is cancelled before it finishes. Thread-safe: the calls that make up one
/// unit of work may run concurrently.
/// </summary>
public sealed class ModelUsageAccumulator
{
    /// <summary>
    /// Guards the running sum against concurrent folds.
    /// </summary>
    private readonly Lock _gate = new();

    /// <summary>
    /// The sum of every usage folded in so far.
    /// </summary>
    private ModelUsage _accrued = ModelUsage.Zero;

    /// <summary>
    /// The running total, cost and tokens, folded in so far.
    /// </summary>
    public ModelUsage Accrued
    {
        get
        {
            // Read under the lock so a concurrent fold can't tear the value.
            lock (_gate)
                return _accrued;
        }
    }

    /// <summary>
    /// Folds one call's usage into the running total.
    /// </summary>
    /// <param name="usage">The call's cost and tokens.</param>
    public void Add(ModelUsage usage)
    {
        // Fold under the lock so concurrent calls don't lose each other's contribution.
        lock (_gate)
            _accrued += usage;
    }
}
