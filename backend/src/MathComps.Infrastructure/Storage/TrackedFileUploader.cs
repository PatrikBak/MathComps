using System.Security.Cryptography;
using System.Text.Json;

using Microsoft.Extensions.Options;
using MathComps.Shared.Serialization;

namespace MathComps.Infrastructure.Storage;

/// <summary>
/// An <see cref="ITrackedFileUploader"/> that decorates another <see cref="IFileUploader"/>, backing its skip
/// tracking with a JSON ledger of storage key → source-file content hash: a file counts as already on remote storage
/// when its bytes hash to the recorded value. Hashing rather than timestamping is what lets a regenerated artefact
/// take part — a generator rewrites its output every run, so any mtime comparison would push the whole set every
/// time — and it also keeps a fresh checkout, whose files all carry a current mtime, from re-pushing everything.
/// It dedupes within a run too, so a key sent once isn't sent again even when two sources resolve to it (e.g.
/// handout language variants sharing an asset). Register it over the base uploader with Scrutor's <c>Decorate</c>;
/// the ledger path comes from <see cref="UploadLedgerOptions"/>.
/// </summary>
/// <param name="inner">The uploader the bytes actually go through.</param>
/// <param name="options">Carries the ledger path read from and written back to.</param>
public sealed class TrackedFileUploader(IFileUploader inner, IOptions<UploadLedgerOptions> options)
    : ITrackedFileUploader, IDisposable
{
    /// <inheritdoc cref="UploadLedgerOptions.LedgerPath"/>
    private readonly string _ledgerPath = options.Value.LedgerPath;

    /// <summary>
    /// Maps each storage key to the hash of the bytes last pushed under it. Missing entry ⇒ never uploaded ⇒ must
    /// push. Loaded from the ledger file, empty when it doesn't exist yet.
    /// </summary>
    private readonly Dictionary<string, string> _ledger = File.Exists(options.Value.LedgerPath)
        ? ReadLedger(options.Value.LedgerPath)
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
        var sourceHash = HashFile(sourcePath);

        // Skip when a sibling source already sent this key this run, or remote storage has these exact bytes.
        if (_uploadedThisRun.Contains(key)
            || (_ledger.TryGetValue(key, out var lastHash) && sourceHash == lastHash))
            return false;

        // Push the bytes.
        await inner.UploadAsync(sourcePath, key);

        // Mark the key handled for the rest of this run and record the hash the next run will compare against.
        _uploadedThisRun.Add(key);
        _ledger[key] = sourceHash;
        return true;
    }

    /// <summary>
    /// Reads the ledger, treating one written in an older format as an empty one. A ledger that can't be understood
    /// is only ever a lost optimisation: the run re-pushes everything once and writes the current format back.
    /// </summary>
    /// <param name="ledgerPath"><inheritdoc cref="UploadLedgerOptions.LedgerPath" path="/summary"/></param>
    /// <returns>The recorded hash per storage key.</returns>
    private static Dictionary<string, string> ReadLedger(string ledgerPath)
    {
        try
        {
            // The recorded hashes
            return File.ReadAllText(ledgerPath).FromJson<Dictionary<string, string>>();
        }
        catch (JsonException)
        {
            // Nothing usable in there, so start over rather than failing the run
            return [];
        }
    }

    /// <summary>
    /// Hashes a file's bytes into the form the ledger records. SHA-256 hex, chosen for being the boring default
    /// rather than for any property of the content — this only ever answers "are these the same bytes".
    /// </summary>
    /// <param name="sourcePath">Absolute path to the file to hash.</param>
    /// <returns>The lowercase hex digest.</returns>
    private static string HashFile(string sourcePath)
    {
        // Streamed rather than read whole, since handout PDFs run to megabytes
        using var stream = File.OpenRead(sourcePath);

        // The digest, lowercased so a ledger written on any platform compares equal
        return Convert.ToHexStringLower(SHA256.HashData(stream));
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
