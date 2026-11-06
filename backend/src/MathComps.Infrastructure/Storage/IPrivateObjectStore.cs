namespace MathComps.Infrastructure.Storage;

/// <summary>
/// Object storage nobody reads directly: the application writes files into it and reads them back itself, deciding who
/// sees what they hold.
/// </summary>
public interface IPrivateObjectStore
{
    /// <summary>
    /// Stores a file under a key, replacing whatever was there.
    /// </summary>
    /// <param name="key">The object key.</param>
    /// <param name="content">The file's bytes.</param>
    /// <param name="contentType">The file's media type, which it is served with.</param>
    /// <param name="cancellationToken">Cancels the write.</param>
    /// <returns>A task that completes once the file is stored.</returns>
    Task PutAsync(string key, byte[] content, string contentType, CancellationToken cancellationToken);
}
