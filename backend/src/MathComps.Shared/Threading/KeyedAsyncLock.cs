using System.Collections.Concurrent;

namespace MathComps.Shared.Threading;

/// <summary>
/// An async lock per key: awaiting a key's slot serializes all work done under that key while leaving other keys
/// untouched. A key's lock is minted on first use and retained for the instance's life, so keep the key space bounded
/// (users, resources) rather than unbounded (request ids).
/// </summary>
/// <typeparam name="TKey">The key type the locks are partitioned by.</typeparam>
public sealed class KeyedAsyncLock<TKey>
    where TKey : notnull
{
    /// <summary>
    /// One serializing lock per key, created on first use and kept thereafter.
    /// </summary>
    private readonly ConcurrentDictionary<TKey, SemaphoreSlim> _perKey = new();

    /// <summary>
    /// Waits for exclusive access to a key's slot, returning a handle that frees it when disposed.
    /// </summary>
    /// <param name="key">The key whose work to serialize.</param>
    /// <param name="cancellationToken">A token to abandon the wait.</param>
    /// <returns>A handle releasing the slot on disposal.</returns>
    public async Task<IDisposable> AcquireAsync(TKey key, CancellationToken cancellationToken = default)
    {
        // The key's lock, minted on its first use.
        var semaphore = _perKey.GetOrAdd(key, _ => new SemaphoreSlim(1, 1));

        // Wait for the slot; a cancelled wait throws and acquires nothing.
        await semaphore.WaitAsync(cancellationToken);

        // Hand back a releaser that frees the slot once.
        return new Releaser(semaphore);
    }

    /// <summary>
    /// Frees a held slot exactly once, however many times it is disposed.
    /// </summary>
    /// <param name="semaphore">The lock to release.</param>
    private sealed class Releaser(SemaphoreSlim semaphore) : IDisposable
    {
        /// <summary>
        /// The held lock, nulled out the first time it's released.
        /// </summary>
        private SemaphoreSlim? _semaphore = semaphore;

        /// <inheritdoc/>
        public void Dispose()
            // Release the slot the first time only; a second dispose is a no-op.
            => Interlocked.Exchange(ref _semaphore, null)?.Release();
    }
}
