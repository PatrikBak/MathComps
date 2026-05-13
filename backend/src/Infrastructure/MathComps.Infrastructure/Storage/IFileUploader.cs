namespace MathComps.Infrastructure.Storage;

/// <summary>
/// Abstraction for uploading files to remote storage.
/// </summary>
public interface IFileUploader
{
    /// <summary>
    /// Uploads a local file to remote storage at the specified key.
    /// </summary>
    /// <param name="localFilePath">Absolute path to the local file to upload.</param>
    /// <param name="key">The storage key (e.g., "handouts/pdfs/factorization.sk.pdf").</param>
    /// <returns>A task representing the asynchronous upload operation.</returns>
    Task UploadAsync(string localFilePath, string key);
}
