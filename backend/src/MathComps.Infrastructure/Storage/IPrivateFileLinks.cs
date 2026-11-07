namespace MathComps.Infrastructure.Storage;

/// <summary>
/// Links straight to files in the <see cref="IPrivateObjectStore"/>, for a browser that may read one. Whoever
/// holds a link reaches its file until the link expires, so the application hands one only to a viewer it has already
/// let see the file.
/// </summary>
public interface IPrivateFileLinks
{
    /// <summary>
    /// How long a read link works from when it was signed.
    /// </summary>
    TimeSpan LinkLifetime { get; }

    /// <summary>
    /// A link reading the file under a key, which works for <see cref="LinkLifetime"/> from when it was signed.
    /// </summary>
    /// <param name="key">The object key.</param>
    /// <returns>The link.</returns>
    string LinkFor(string key);
}
