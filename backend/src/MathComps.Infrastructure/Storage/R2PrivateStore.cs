using System.Diagnostics;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;

namespace MathComps.Infrastructure.Storage;

/// <summary>
/// The private Cloudflare R2 bucket, through an <see cref="R2Bucket"/>, as the <see cref="IPrivateObjectStore"/>, the
/// <see cref="IObjectReader"/> of what it holds, and the <see cref="IPrivateFileLinks"/> to it. Files go in with no
/// caching of their own, each read is logged with how long R2 took to answer, and each link is R2's own presigned
/// one, signed afresh on every call.
/// </summary>
/// <param name="logger">The logger.</param>
/// <param name="r2Settings">The R2 connection settings, naming the private bucket.</param>
/// <param name="privateFileLinkSettings">The settings saying how long a read link works.</param>
public sealed class R2PrivateStore(
    ILogger<R2PrivateStore> logger,
    IOptions<R2Settings> r2Settings,
    IOptions<PrivateFileLinkSettings> privateFileLinkSettings)
    : IPrivateObjectStore, IObjectReader, IPrivateFileLinks, IDisposable
{
    /// <summary>
    /// The private bucket the files live in.
    /// </summary>
    private readonly R2Bucket _bucket =
        new(r2Settings.Value, r2Settings.Value.PrivateBucketName, nameof(R2Settings.PrivateBucketName));

    /// <inheritdoc/>
    public async Task PutAsync(string key, byte[] content, string contentType, CancellationToken cancellationToken)
    {
        // The file's bytes to send
        using var body = new MemoryStream(content, writable: false);

        // Store them, for the application alone to read
        await _bucket.PutAsync(key, body, contentType, cacheControl: null, cancellationToken);
    }

    /// <inheritdoc/>
    public Task<string?> ReadTextAsync(string key, CancellationToken cancellationToken) =>
        // The object's text, its read timed
        TimedReadAsync(key, _bucket.ReadTextAsync, cancellationToken);

    /// <inheritdoc/>
    public Task<byte[]?> ReadBytesAsync(string key, CancellationToken cancellationToken) =>
        // The object's bytes, their read timed
        TimedReadAsync(key, _bucket.ReadBytesAsync, cancellationToken);

    /// <inheritdoc/>
    public TimeSpan LinkLifetime => privateFileLinkSettings.Value.LinkLifetime;

    /// <inheritdoc/>
    public string LinkFor(string key) =>
        // Signed now, for as long as every read link works
        _bucket.SignGetUrl(key, DateTimeOffset.UtcNow + LinkLifetime);

    /// <inheritdoc/>
    /// <remarks>The container may dispose this one instance once per registration, which the S3 client
    /// tolerates.</remarks>
    public void Dispose() =>
        // Dispose the bucket's client
        _bucket.Dispose();

    /// <summary>
    /// Reads an object from the bucket and logs the read, with how long R2 took to answer, so a slow storage answer
    /// shows in the log.
    /// </summary>
    /// <typeparam name="T">What the object is read into.</typeparam>
    /// <param name="key">The object key to read.</param>
    /// <param name="read">Reads the object from the bucket.</param>
    /// <param name="cancellationToken">Cancels the read.</param>
    /// <returns>What the object was read into, or null when nothing is stored under that key.</returns>
    private async Task<T?> TimedReadAsync<T>(
        string key, Func<string, CancellationToken, Task<T?>> read, CancellationToken cancellationToken)
        where T : class
    {
        // Time the read
        var stopwatch = Stopwatch.StartNew();

        // Ask for the object
        var content = await read(key, cancellationToken);

        // The read that found nothing
        if (content is null)
        {
            // Say so, with how long R2 took to answer
            logger.LogInformation(
                "Nothing at {Key} in R2, answered in {ElapsedMs} ms", key, stopwatch.ElapsedMilliseconds);

            // Nothing is stored under that key
            return null;
        }

        // The read that found the object
        logger.LogInformation("Read {Key} from R2 in {ElapsedMs} ms", key, stopwatch.ElapsedMilliseconds);

        // The object as read
        return content;
    }
}
