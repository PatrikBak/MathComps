using System.Collections.Immutable;
using MathComps.Infrastructure.Storage;
using static Microsoft.Extensions.Options.Options;
using MathComps.Shared.Serialization;

namespace MathComps.Infrastructure.Tests.Storage;

/// <summary>
/// Unit tests for <see cref="TrackedFileUploader"/>: the change detection that skips files unchanged since their
/// last upload, the in-run dedup, and the ledger persistence (on dispose) that lets a later run skip files already
/// on remote storage. The inner uploader is faked and real temp files supply real mtimes, so no network or database
/// is involved.
/// </summary>
public sealed class TrackedFileUploaderTests : IDisposable
{
    /// <summary>
    /// A scratch directory holding the test's source files and ledger, removed when the test finishes.
    /// </summary>
    private readonly string _workDir =
        Path.Combine(Path.GetTempPath(), $"tracked-uploader-{Guid.NewGuid():N}");

    /// <summary>
    /// The ledger path under the scratch directory.
    /// </summary>
    private readonly string _ledgerPath;

    /// <summary>
    /// Creates the scratch directory the test writes into.
    /// </summary>
    public TrackedFileUploaderTests()
    {
        // The scratch directory the source files and ledger live in.
        Directory.CreateDirectory(_workDir);
        _ledgerPath = Path.Combine(_workDir, "ledger.json");
    }

    /// <inheritdoc/>
    public void Dispose() =>
        // Remove the scratch directory and everything under it.
        Directory.Delete(_workDir, recursive: true);

    /// <summary>
    /// A brand-new key is uploaded and recorded in the ledger that disposing the uploader persists.
    /// </summary>
    [Fact]
    public async Task A_new_key_is_uploaded_and_recorded()
    {
        // A source file and a fresh tracker over an empty ledger.
        var source = WriteSource("fig.svg", "<svg/>");
        var inner = new RecordingFileUploader();
        var tracker = Tracker(inner);

        // The first push of a new key goes out and reaches the inner uploader.
        var uploaded = await tracker.UploadIfChangedAsync(source, "problems/fig");
        Assert.True(uploaded);
        Assert.Single(inner.Uploads);

        // Disposing persists the key for the next run to compare against.
        tracker.Dispose();
        var ledger = File.ReadAllText(_ledgerPath).FromJson<Dictionary<string, DateTime>>();
        Assert.True(ledger.ContainsKey("problems/fig"));
    }

    /// <summary>
    /// A later run skips a file whose bytes are already on remote storage — its mtime hasn't advanced past the
    /// recorded one — and the inner uploader sees no second call.
    /// </summary>
    [Fact]
    public async Task A_reloaded_unchanged_file_is_skipped()
    {
        // Push a file and persist the ledger by disposing.
        var source = WriteSource("fig.svg", "<svg/>");
        var inner = new RecordingFileUploader();
        var firstRun = Tracker(inner);
        await firstRun.UploadIfChangedAsync(source, "problems/fig");
        firstRun.Dispose();

        // A second run over the same (untouched) file and ledger skips it — no new call left the process.
        var secondRun = Tracker(inner);
        var uploaded = await secondRun.UploadIfChangedAsync(source, "problems/fig");
        Assert.False(uploaded);
        Assert.Single(inner.Uploads);
    }

    /// <summary>
    /// A file whose mtime has advanced past the recorded one is re-uploaded — its bytes may have changed.
    /// </summary>
    [Fact]
    public async Task A_file_with_a_newer_mtime_is_re_uploaded()
    {
        // Push a file and persist the ledger by disposing.
        var source = WriteSource("fig.svg", "<svg/>");
        var inner = new RecordingFileUploader();
        var firstRun = Tracker(inner);
        await firstRun.UploadIfChangedAsync(source, "problems/fig");
        firstRun.Dispose();

        // Bump the file's mtime an hour into the future, as a rewrite would.
        File.SetLastWriteTimeUtc(source, File.GetLastWriteTimeUtc(source).AddHours(1));

        // A second run sees the fresher file and pushes it again — the inner uploader saw the second call.
        var secondRun = Tracker(inner);
        var uploaded = await secondRun.UploadIfChangedAsync(source, "problems/fig");
        Assert.True(uploaded);
        Assert.Equal(2, inner.Uploads.Count);
    }

    /// <summary>
    /// The same key pushed twice in one run uploads once — the second source resolving to it is deduped.
    /// </summary>
    [Fact]
    public async Task The_same_key_twice_in_one_run_uploads_once()
    {
        // Two sources both targeting the same key, within one run.
        var first = WriteSource("a.svg", "<svg/>");
        var second = WriteSource("b.svg", "<svg/>");
        var inner = new RecordingFileUploader();
        var tracker = Tracker(inner);

        // Make the second source unambiguously newer than the first, so the mtime check alone would re-upload it —
        // the only thing that can skip it is the in-run dedup we're actually testing.
        File.SetLastWriteTimeUtc(second, File.GetLastWriteTimeUtc(first).AddHours(1));

        // The first push goes out; the second to the same key is skipped, so only the first reached the inner.
        var firstUploaded = await tracker.UploadIfChangedAsync(first, "problems/shared");
        var secondUploaded = await tracker.UploadIfChangedAsync(second, "problems/shared");
        Assert.True(firstUploaded);
        Assert.False(secondUploaded);
        Assert.Single(inner.Uploads);
    }

    /// <summary>
    /// The persisted ledger lists its keys in ordinal order, so the file stays readable and its diffs stay stable.
    /// </summary>
    [Fact]
    public async Task The_persisted_ledger_is_sorted_by_key()
    {
        // Push three keys out of sorted order, then persist by disposing.
        var source = WriteSource("fig.svg", "<svg/>");
        var inner = new RecordingFileUploader();
        var tracker = Tracker(inner);
        await tracker.UploadIfChangedAsync(source, "problems/charlie");
        await tracker.UploadIfChangedAsync(source, "problems/alpha");
        await tracker.UploadIfChangedAsync(source, "problems/bravo");
        tracker.Dispose();

        // The keys appear alphabetically in the file, not in insertion order.
        var text = File.ReadAllText(_ledgerPath);
        Assert.True(text.IndexOf("alpha", StringComparison.Ordinal) < text.IndexOf("bravo", StringComparison.Ordinal));
        Assert.True(text.IndexOf("bravo", StringComparison.Ordinal) < text.IndexOf("charlie", StringComparison.Ordinal));
    }

    /// <summary>
    /// Builds a tracker over the given uploader pointed at this test's scratch ledger.
    /// </summary>
    /// <param name="inner">The uploader to wrap.</param>
    /// <returns>The tracker.</returns>
    private TrackedFileUploader Tracker(IFileUploader inner) =>
        new(inner, Create(new UploadLedgerOptions { LedgerPath = _ledgerPath }));

    /// <summary>
    /// Writes a source file under the scratch directory and returns its path.
    /// </summary>
    /// <param name="name">The file name.</param>
    /// <param name="content">The file content.</param>
    /// <returns>The absolute path to the written file.</returns>
    private string WriteSource(string name, string content)
    {
        // Write it into the scratch directory.
        var path = Path.Combine(_workDir, name);
        File.WriteAllText(path, content);
        return path;
    }

    /// <summary>
    /// A test double for <see cref="IFileUploader"/> that records uploads instead of hitting remote storage.
    /// </summary>
    private sealed class RecordingFileUploader : IFileUploader
    {
        /// <summary>
        /// Every upload, in call order.
        /// </summary>
        public ImmutableList<(string LocalPath, string Key)> Uploads { get; private set; } = [];

        /// <inheritdoc/>
        public Task UploadAsync(string localFilePath, string key)
        {
            // Record the call; nothing leaves the process.
            Uploads = Uploads.Add((localFilePath, key));
            return Task.CompletedTask;
        }
    }
}
