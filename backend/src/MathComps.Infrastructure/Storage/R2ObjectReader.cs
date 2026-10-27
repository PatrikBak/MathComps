using System.Diagnostics;
using System.Net;

using Amazon.S3;
using Amazon.S3.Model;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;

namespace MathComps.Infrastructure.Storage;

/// <summary>
/// An <see cref="IObjectReader"/> over Cloudflare R2 (S3-compatible) storage. R2 answers a read for a key it holds
/// nothing under with a 404 that the SDK surfaces as an exception rather than a response, so that status code is
/// what this translates back into an absent object. Each read is logged with how long R2 took to answer.
/// </summary>
public sealed class R2ObjectReader : IObjectReader, IDisposable
{
    /// <summary>
    /// The underlying S3 client configured for the Cloudflare R2 endpoint.
    /// </summary>
    private readonly AmazonS3Client _client;

    /// <summary>
    /// The R2 bucket name objects are read from.
    /// </summary>
    private readonly string _bucketName;

    /// <summary>
    /// The logger each read is written to.
    /// </summary>
    private readonly ILogger<R2ObjectReader> _logger;

    /// <summary>
    /// Creates a new R2 reader from the provided settings.
    /// </summary>
    /// <param name="logger">The logger.</param>
    /// <param name="options">R2 connection settings resolved from the options pipeline.</param>
    public R2ObjectReader(ILogger<R2ObjectReader> logger, IOptions<R2Settings> options)
    {
        // Keep the logger
        _logger = logger;

        // Unwrap the validated settings
        var settings = options.Value;

        // Store the bucket name
        _bucketName = settings.BucketName;

        // The client every R2 call goes through
        _client = R2ClientFactory.Create(settings);
    }

    /// <inheritdoc/>
    public async Task<string?> ReadTextAsync(string key, CancellationToken cancellationToken)
    {
        // Ask for the object
        var request = new GetObjectRequest { BucketName = _bucketName, Key = key };

        // Time the read, so a slow storage answer shows in the log
        var stopwatch = Stopwatch.StartNew();

        try
        {
            // Fetch it
            using var response = await _client.GetObjectAsync(request, cancellationToken);

            // Read the body out before the response is disposed
            using var reader = new StreamReader(response.ResponseStream);
            var content = await reader.ReadToEndAsync(cancellationToken);

            // The read that found the object
            _logger.LogInformation("Read {Key} from R2 in {ElapsedMs} ms", key, stopwatch.ElapsedMilliseconds);

            // The object's text
            return content;
        }
        catch (AmazonS3Exception exception) when (exception.StatusCode == HttpStatusCode.NotFound)
        {
            // The read that found nothing
            _logger.LogInformation(
                "Nothing at {Key} in R2, answered in {ElapsedMs} ms", key, stopwatch.ElapsedMilliseconds);

            // Nothing is stored under that key
            return null;
        }
    }

    /// <inheritdoc/>
    public void Dispose() =>
        // Dispose the underlying S3 client
        _client.Dispose();
}
