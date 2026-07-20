using MathComps.Shared.Threading;

namespace MathComps.Shared.Tests.Threading;

/// <summary>
/// Tests for <see cref="KeyedAsyncLock{TKey}"/>: that one key's slot serializes work under it, that distinct keys run
/// without blocking each other, that the slot is freed on the exception path, that a second dispose can't over-release
/// the slot, and that a cancelled wait acquires nothing.
/// </summary>
public class KeyedAsyncLockTests
{
    /// <summary>
    /// A second acquire of the same key waits until the first handle is disposed, then proceeds.
    /// </summary>
    [Fact]
    public async Task Same_key_serializes_the_second_acquire()
    {
        // A lock and a held slot for key "k"
        var gate = new KeyedAsyncLock<string>();
        var first = await gate.AcquireAsync("k");

        // A second acquire of the same key while the first is held
        var secondAcquire = gate.AcquireAsync("k");

        // It's blocked: the slot is taken, so the wait hasn't completed
        Assert.False(secondAcquire.IsCompleted);

        // Free the slot
        first.Dispose();

        // The second acquire now completes
        var second = await secondAcquire;
        second.Dispose();
    }

    /// <summary>
    /// Two different keys acquire independently — holding one doesn't block the other.
    /// </summary>
    [Fact]
    public async Task Different_keys_do_not_block_each_other()
    {
        // A lock holding key "a"
        var gate = new KeyedAsyncLock<string>();
        using var heldA = await gate.AcquireAsync("a");

        // Acquiring a different key
        var acquireB = gate.AcquireAsync("b");

        // It completes synchronously: a distinct key has its own free slot
        Assert.True(acquireB.IsCompleted);
        (await acquireB).Dispose();
    }

    /// <summary>
    /// A body that throws while holding the slot still frees it, so the next same-key acquire proceeds.
    /// </summary>
    [Fact]
    public async Task Slot_is_freed_when_the_held_body_throws()
    {
        // A lock, and a critical section that throws while holding key "k"
        var gate = new KeyedAsyncLock<string>();
        await Assert.ThrowsAsync<InvalidOperationException>(async () =>
        {
            // The using frees the slot as the exception unwinds
            using var handle = await gate.AcquireAsync("k");
            throw new InvalidOperationException("boom");
        });

        // The slot was freed on the way out, so a fresh acquire of the same key completes
        var again = gate.AcquireAsync("k");
        Assert.True(again.IsCompleted);
        (await again).Dispose();
    }

    /// <summary>
    /// Disposing a handle twice releases the slot once: the second dispose is a no-op, not an over-release that would
    /// let two callers hold the same key at once.
    /// </summary>
    [Fact]
    public async Task Double_dispose_does_not_over_release_the_slot()
    {
        // A lock with a held handle for key "k"
        var gate = new KeyedAsyncLock<string>();
        var handle = await gate.AcquireAsync("k");

        // Dispose it twice — the second must be a no-op
        handle.Dispose();
        handle.Dispose();

        // One acquire of the key succeeds against the single freed slot
        var firstAgain = gate.AcquireAsync("k");
        Assert.True(firstAgain.IsCompleted);

        // A second is blocked: the double dispose didn't leak an extra slot (which would let this through)
        var secondAgain = gate.AcquireAsync("k");
        Assert.False(secondAgain.IsCompleted);

        // Release the held slot so the blocked waiter can finish
        (await firstAgain).Dispose();
        (await secondAgain).Dispose();
    }

    /// <summary>
    /// A wait cancelled before the slot frees throws and acquires nothing, leaving the holder's slot untouched.
    /// </summary>
    [Fact]
    public async Task Cancelled_wait_acquires_nothing()
    {
        // A lock with key "k" held
        var gate = new KeyedAsyncLock<string>();
        using var held = await gate.AcquireAsync("k");

        // A wait on the held key with an already-cancelled token
        using var cts = new CancellationTokenSource();
        await cts.CancelAsync();

        // The cancelled wait throws rather than acquiring
        await Assert.ThrowsAnyAsync<OperationCanceledException>(() => gate.AcquireAsync("k", cts.Token));

        // The holder's slot is untouched: an honest wait still blocks, so nothing was phantom-released
        // ReSharper disable once MethodSupportsCancellation
        var afterCancel = gate.AcquireAsync("k");
        Assert.False(afterCancel.IsCompleted);

        // Free the slot so the honest waiter can finish
        // ReSharper disable once DisposeOnUsingVariable
        held.Dispose();
        (await afterCancel).Dispose();
    }
}
