using System.Diagnostics;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;

namespace MathComps.Infrastructure.Storage;

/// <summary>
/// The private Cloudflare R2 bucket, through an <see cref="R2Bucket"/>, as both the <see cref="IPrivateObjectStore"/>
/// and the <see cref="IObjectReader"/> of what it holds. Files go in with no caching of their own, since nobody reads
/// them straight from the bucket, and each read is logged with how long R2 took to answer.
/// </summary>
/// <param name="logger">The logger.</param>
/// <param name="r2Settings">The R2 connection settings, naming the private bucket.</param>
public sealed class R2PrivateStore(ILogger<R2PrivateStore> logger, IOptions<R2Settings> r2Settings)
    : IPrivateObjectStore, IObjectReader, IDisposable
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
    public async Task<string?> ReadTextAsync(string key, CancellationToken cancellationToken)
    {
        // Time the read, so a slow storage answer shows in the log
        var stopwatch = Stopwatch.StartNew();

        // Ask for the object
        var content = await _bucket.ReadTextAsync(key, cancellationToken);

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

        // The object's text
        return content;
    }

    /// <inheritdoc/>
    /// <remarks>The container may dispose this one instance once per registration, which the S3 client
    /// tolerates.</remarks>
    public void Dispose() =>
        // Dispose the bucket's client
        _bucket.Dispose();
}
