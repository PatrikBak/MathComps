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
            // R2's one region. Left to the SDK, the region read off the R2 host is us-east-1, where a presigned link
            // falls back to signature version 2, which R2 refuses
            AuthenticationRegion = "auto",
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
    public Task<string?> ReadTextAsync(string key, CancellationToken cancellationToken) =>
        // The body read out as text
        ReadAsync(key, async (body, token) =>
        {
            // A reader over the body
            using var reader = new StreamReader(body);

            // The object's text
            return await reader.ReadToEndAsync(token);
        }, cancellationToken);

    /// <summary>
    /// Reads the bytes stored under a key.
    /// </summary>
    /// <param name="key">The object key.</param>
    /// <param name="cancellationToken">Cancels the read.</param>
    /// <returns>The file's bytes, or null when nothing is stored under that key.</returns>
    public Task<byte[]?> ReadBytesAsync(string key, CancellationToken cancellationToken) =>
        // The body read out whole
        ReadAsync(key, async (body, token) =>
        {
            // Somewhere to collect the body
            using var bytes = new MemoryStream();

            // Collect the body
            await body.CopyToAsync(bytes, token);

            // The object's bytes
            return bytes.ToArray();
        }, cancellationToken);

    /// <summary>
    /// Reads the file stored under a key, handing its body to a reader before the response is let go.
    /// </summary>
    /// <typeparam name="T">What the body is read into.</typeparam>
    /// <param name="key">The object key.</param>
    /// <param name="readBody">Reads the file's body into its result.</param>
    /// <param name="cancellationToken">Cancels the read.</param>
    /// <returns>What the body was read into, or null when nothing is stored under that key.</returns>
    private async Task<T?> ReadAsync<T>(
        string key, Func<Stream, CancellationToken, Task<T>> readBody, CancellationToken cancellationToken)
        where T : class
    {
        try
        {
            // Ask for the object
            using var response = await _client.GetObjectAsync(
                new GetObjectRequest { BucketName = _bucketName, Key = key }, cancellationToken);

            // Read the body out before the response is disposed
            return await readBody(response.ResponseStream, cancellationToken);
        }
        catch (AmazonS3Exception exception)
            when (exception.StatusCode == HttpStatusCode.NotFound && exception.ErrorCode != "NoSuchBucket")
        {
            // Nothing is stored under that key. A bucket that doesn't exist answers 404 too, and stays an error
            return null;
        }
    }

    /// <summary>
    /// Signs a link that reads the file under a key, for anyone holding it until it expires.
    /// </summary>
    /// <param name="key">The object key.</param>
    /// <param name="expiresAt">When the link stops working.</param>
    /// <returns>The signed link.</returns>
    public string SignGetUrl(string key, DateTimeOffset expiresAt) =>
        // A read of the key, signed by the bucket's credentials
        _client.GetPreSignedURL(new GetPreSignedUrlRequest
        {
            BucketName = _bucketName,
            Key = key,
            Verb = HttpVerb.GET,
            Expires = expiresAt.UtcDateTime,
        });

    /// <inheritdoc/>
    public void Dispose() =>
        // Dispose the underlying S3 client
        _client.Dispose();
}
