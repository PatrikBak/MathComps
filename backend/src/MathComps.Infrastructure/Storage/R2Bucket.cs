using System.Net;
using Amazon.S3;
using Amazon.S3.Model;

namespace MathComps.Infrastructure.Storage;

/// <summary>
/// One Cloudflare R2 bucket, reached through its S3-compatible API. Every R2 call the application makes goes through
/// here, so the endpoint shape and the addressing and signing quirks R2 needs are stated once. R2 answers a key it
/// holds nothing under with a 404 that the SDK raises as an exception, which is what turns into an absent file here.
/// </summary>
/// <param name="settings">The account's connection settings.</param>
/// <param name="bucketName">The bucket's name, empty when the host's settings leave the bucket out.</param>
/// <param name="bucketSetting">The setting naming the bucket, which the error for a left-out name points at.</param>
internal sealed class R2Bucket(R2Settings settings, string bucketName, string bucketSetting) : IDisposable
{
    /// <summary>
    /// The bucket's name, required once something reaches for the bucket.
    /// </summary>
    private readonly string _bucketName = string.IsNullOrWhiteSpace(bucketName)
        ? throw new InvalidOperationException(
            $"{R2Settings.SectionName}:{bucketSetting} is not set, and this run reaches that bucket.")
        : bucketName;

    /// <summary>
    /// The S3 client pointed at the bucket's R2 account, authenticated with its credentials.
    /// </summary>
    private readonly AmazonS3Client _client = new(
        settings.AccessKeyId,
        settings.SecretAccessKey,
        new AmazonS3Config
        {
            ServiceURL = $"https://{settings.AccountId}.r2.cloudflarestorage.com",
            // R2 requires path-style addressing
            ForcePathStyle = true,
        });

    /// <summary>
    /// Stores a file under a key, replacing whatever was there.
    /// </summary>
    /// <param name="key">The object key.</param>
    /// <param name="content">The file's bytes, read from where the stream stands.</param>
    /// <param name="contentType">The file's media type, which it is served with.</param>
    /// <param name="cacheControl">How the file may be cached by whoever reads it straight from the bucket, or null when
    /// nobody does.</param>
    /// <param name="cancellationToken">Cancels the write.</param>
    /// <returns>A task that completes once the file is stored.</returns>
    public async Task PutAsync(
        string key, Stream content, string contentType, string? cacheControl, CancellationToken cancellationToken)
    {
        // The write of the file under the key
        var request = new PutObjectRequest
        {
            BucketName = _bucketName,
            Key = key,
            InputStream = content,
            ContentType = contentType,
            // R2 does not support streaming SigV4 payload signing
            DisablePayloadSigning = true,
        };

        // With how readers may cache it, when anyone reads it straight from the bucket
        if (cacheControl is not null)
            request.Headers.CacheControl = cacheControl;

        // Store it
        await _client.PutObjectAsync(request, cancellationToken);
    }

    /// <summary>
    /// Reads the text stored under a key.
    /// </summary>
    /// <param name="key">The object key.</param>
    /// <param name="cancellationToken">Cancels the read.</param>
    /// <returns>The file's text, or null when nothing is stored under that key.</returns>
    public async Task<string?> ReadTextAsync(string key, CancellationToken cancellationToken)
    {
        try
        {
            // Ask for the object
            using var response = await _client.GetObjectAsync(
                new GetObjectRequest { BucketName = _bucketName, Key = key }, cancellationToken);

            // Read the body out before the response is disposed
            using var reader = new StreamReader(response.ResponseStream);

            // The object's text
            return await reader.ReadToEndAsync(cancellationToken);
        }
        catch (AmazonS3Exception exception)
            when (exception.StatusCode == HttpStatusCode.NotFound && exception.ErrorCode != "NoSuchBucket")
        {
            // Nothing is stored under that key. A bucket that doesn't exist answers 404 too, and stays an error
            return null;
        }
    }

    /// <inheritdoc/>
    public void Dispose() =>
        // Dispose the underlying S3 client
        _client.Dispose();
}
