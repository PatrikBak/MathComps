namespace MathComps.Infrastructure.Storage;

/// <summary>
/// Reads text objects back out of the <see cref="IPrivateObjectStore"/>, for content the application publishes there
/// and then serves itself from.
/// </summary>
public interface IObjectReader
{
    /// <summary>
    /// Reads the object stored under a key.
    /// </summary>
    /// <param name="key">The object key to read.</param>
    /// <param name="cancellationToken">Cancels the read.</param>
    /// <returns>The object's content, or null when nothing is stored under that key.</returns>
    Task<string?> ReadTextAsync(string key, CancellationToken cancellationToken);
}
