namespace MathComps.Infrastructure.Services.Ai;

/// <summary>
/// Implements <see cref="ILlmSpendTracker"/> with a lock-guarded running total, so replies landing concurrently
/// fold in without tearing.
/// </summary>
public class LlmSpendTracker : ILlmSpendTracker
{
    /// <summary>
    /// Guards the running total — replies land concurrently.
    /// </summary>
    private readonly Lock _gate = new();

    /// <inheritdoc cref="Total"/>
    private decimal _total;

    /// <inheritdoc/>
    public decimal Total
    {
        get
        {
            // Read under the gate so a concurrent add is either fully in or fully out.
            lock (_gate)
                return _total;
        }
    }

    /// <inheritdoc/>
    public void Add(decimal cost)
    {
        // Fold it in under the gate.
        lock (_gate)
            _total += cost;
    }
}
