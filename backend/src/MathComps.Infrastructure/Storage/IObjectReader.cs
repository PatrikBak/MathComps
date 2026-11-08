namespace MathComps.Infrastructure.Storage;

/// <summary>
/// Reads objects back out of the <see cref="IPrivateObjectStore"/>, for files the application keeps there and then
/// reads itself.
/// </summary>
public interface IObjectReader
{
    /// <summary>
    /// Reads the text object stored under a key.
    /// </summary>
    /// <param name="key">The object key to read.</param>
    /// <param name="cancellationToken">Cancels the read.</param>
    /// <returns>The object's text, or null when nothing is stored under that key.</returns>
    Task<string?> ReadTextAsync(string key, CancellationToken cancellationToken);

    /// <summary>
    /// Reads the object stored under a key as its bytes.
    /// </summary>
    /// <param name="key">The object key to read.</param>
    /// <param name="cancellationToken">Cancels the read.</param>
    /// <returns>The object's bytes, or null when nothing is stored under that key.</returns>
    Task<byte[]?> ReadBytesAsync(string key, CancellationToken cancellationToken);
}
