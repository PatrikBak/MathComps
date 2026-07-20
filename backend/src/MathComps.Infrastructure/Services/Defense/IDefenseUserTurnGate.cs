namespace MathComps.Infrastructure.Services.Defense;

/// <summary>
/// Serializes a single user's defense turns so their concurrent requests can't each clear the daily spend check
/// against the same pre-write total. A turn holds the user's gate across its whole run — the guard checks, the
/// engine, and the write — so the next turn sees the previous one's committed spend.
/// </summary>
public interface IDefenseUserTurnGate
{
    /// <summary>
    /// Waits for exclusive access to a user's turn slot, returning a handle that frees it when disposed.
    /// </summary>
    /// <param name="userId">The user whose turns to serialize.</param>
    /// <param name="cancellationToken">A token to abandon the wait.</param>
    /// <returns>A handle releasing the slot on disposal.</returns>
    Task<IDisposable> AcquireAsync(Guid userId, CancellationToken cancellationToken);
}
