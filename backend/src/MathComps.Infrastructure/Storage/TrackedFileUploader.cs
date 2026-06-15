using Microsoft.Extensions.Options;
using MathComps.Shared.Serialization;

namespace MathComps.Infrastructure.Storage;

/// <summary>
/// An <see cref="ITrackedFileUploader"/> that decorates another <see cref="IFileUploader"/>, backing its skip
/// tracking with a JSON ledger of storage key → source-file mtime: a file counts as already on remote storage
/// when its current mtime is not newer than the recorded one. It also dedupes within a run, so a key sent once
/// isn't sent again even when two sources resolve to it (e.g. handout language variants sharing an asset). Register
/// it over the base uploader with Scrutor's <c>Decorate</c>; the ledger path comes from
/// <see cref="UploadLedgerOptions"/>.
/// </summary>
/// <param name="inner">The uploader the bytes actually go through.</param>
/// <param name="options">Carries the ledger path read from and written back to.</param>
public sealed class TrackedFileUploader(IFileUploader inner, IOptions<UploadLedgerOptions> options)
    : ITrackedFileUploader, IDisposable
{
    /// <inheritdoc cref="UploadLedgerOptions.LedgerPath"/>
    private readonly string _ledgerPath = options.Value.LedgerPath;

    /// <summary>
    /// Maps each storage key to the source-file mtime last pushed under it. Missing entry ⇒ never uploaded ⇒ must
    /// push. Loaded from the ledger file, empty when it doesn't exist yet.
    /// </summary>
    private readonly Dictionary<string, DateTime> _ledger = File.Exists(options.Value.LedgerPath)
        ? File.ReadAllText(options.Value.LedgerPath).FromJson<Dictionary<string, DateTime>>()
        : [];

    /// <summary>
    /// Keys already pushed in this run — guards against re-sending the same key when more than one source maps to
    /// it (e.g. handout language variants sharing an asset).
    /// </summary>
    private readonly HashSet<string> _uploadedThisRun = new(StringComparer.Ordinal);

    /// <summary>
    /// Guards <see cref="Dispose"/> against persisting twice — the container holds this one instance under both its
    /// <see cref="IFileUploader"/> and <see cref="ITrackedFileUploader"/> registrations.
    /// </summary>
    private bool _disposed;

    /// <inheritdoc/>
    /// <remarks>Forwards to <see cref="UploadIfChangedAsync"/> and discards the upload-or-skip signal.</remarks>
    public Task UploadAsync(string localFilePath, string key) => UploadIfChangedAsync(localFilePath, key);

    /// <inheritdoc/>
    public async Task<bool> UploadIfChangedAsync(string sourcePath, string key)
    {
        // Capture the version we're about to push up front — this is what we record as "the bytes R2 has now".
        var sourceMtime = File.GetLastWriteTimeUtc(sourcePath);

        // Skip when a sibling source already sent this key this run, or the recorded mtime is at least as fresh.
        if (_uploadedThisRun.Contains(key)
            || (_ledger.TryGetValue(key, out var lastMtime) && sourceMtime <= lastMtime))
            return false;

        // Push the bytes.
        await inner.UploadAsync(sourcePath, key);

        // Mark the key handled for the rest of this run and record the mtime the next run will compare against.
        _uploadedThisRun.Add(key);
        _ledger[key] = sourceMtime;
        return true;
    }

    /// <inheritdoc/>
    /// <remarks>Persists the ledger (at the end of the run) so the next run knows which files remote storage already
    /// has — sorted by key for a readable, diff-friendly file, creating the parent directory if needed.
    /// Idempotent.</remarks>
    public void Dispose()
    {
        // The container may dispose this instance once per registration; persist only the first time.
        if (_disposed)
            return;
        _disposed = true;

        // Make sure the destination directory exists (it may be brand new).
        var directory = Path.GetDirectoryName(_ledgerPath);
        if (!string.IsNullOrEmpty(directory))
            Directory.CreateDirectory(directory);

        // Sort by key for a readable, diff-friendly ledger.
        var sortedLedger = _ledger
            .OrderBy(entry => entry.Key, StringComparer.Ordinal)
            .ToDictionary(entry => entry.Key, entry => entry.Value);

        // Write it out.
        File.WriteAllText(_ledgerPath, sortedLedger.ToJson());
    }
}
