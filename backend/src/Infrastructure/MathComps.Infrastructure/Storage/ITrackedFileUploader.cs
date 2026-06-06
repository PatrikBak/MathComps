namespace MathComps.Infrastructure.Storage;

/// <summary>
/// An <see cref="IFileUploader"/> that remembers what it has already sent, so a file unchanged since its last
/// successful upload is skipped instead of pushed again (and a key sent once in a run isn't sent twice). Plain
/// <see cref="IFileUploader.UploadAsync"/> applies the same skipping silently; <see cref="UploadIfChangedAsync"/>
/// additionally tells the caller whether it uploaded, so the caller can tally as it sees fit. The tracking state
/// is persisted automatically when the uploader is disposed — callers don't manage it.
/// </summary>
public interface ITrackedFileUploader : IFileUploader
{
    /// <summary>
    /// Uploads the file at <paramref name="sourcePath"/> under <paramref name="key"/> only when it isn't already
    /// on remote storage — i.e. it has changed since its last successful upload, or was never uploaded — and
    /// hasn't already been sent in this run.
    /// </summary>
    /// <param name="sourcePath">Absolute path to the local file to upload.</param>
    /// <param name="key">The storage key to upload under.</param>
    /// <returns>True when an upload actually happened, false when it was skipped as unchanged.</returns>
    Task<bool> UploadIfChangedAsync(string sourcePath, string key);
}
