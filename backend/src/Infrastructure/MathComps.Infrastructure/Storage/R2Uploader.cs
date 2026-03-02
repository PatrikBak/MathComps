using Amazon.S3;
using Amazon.S3.Model;
using Microsoft.Extensions.Options;

namespace MathComps.Infrastructure.Storage;

/// <summary>
/// Uploads files to Cloudflare R2 (S3-compatible) storage.
/// </summary>
public sealed class R2Uploader : IFileUploader, IDisposable
{
    /// <summary>
    /// The underlying S3 client configured for the Cloudflare R2 endpoint.
    /// </summary>
    private readonly AmazonS3Client _client;

    /// <summary>
    /// The R2 bucket name to upload files to.
    /// </summary>
    private readonly string _bucketName;

    /// <summary>
    /// Creates a new R2 uploader from the provided settings.
    /// </summary>
    /// <param name="options">R2 connection settings resolved from the options pipeline.</param>
    public R2Uploader(IOptions<R2Settings> options)
    {
        // Unwrap the validated settings
        var settings = options.Value;

        // Store the bucket name
        _bucketName = settings.BucketName;

        // Build the Cloudflare R2 endpoint URL
        var serviceUrl = $"https://{settings.AccountId}.r2.cloudflarestorage.com";

        // Configure the S3 client for R2 compatibility
        var config = new AmazonS3Config
        {
            ServiceURL = serviceUrl,
            // R2 requires path-style addressing
            ForcePathStyle = true,
        };

        // Create the S3 client with explicit credentials
        _client = new AmazonS3Client(settings.AccessKeyId, settings.SecretAccessKey, config);
    }

    /// <summary>
    /// Uploads a local file to R2 at the specified key.
    /// </summary>
    /// <param name="localFilePath">Absolute path to the local file to upload.</param>
    /// <param name="key">The R2 object key (e.g., "handouts/pdfs/factorization.sk.pdf").</param>
    /// <returns>A task representing the asynchronous upload operation.</returns>
    public async Task UploadAsync(string localFilePath, string key)
    {
        // Build the upload request
        var request = new PutObjectRequest
        {
            BucketName = _bucketName,
            Key = key,
            FilePath = localFilePath,
            // R2 does not support streaming SigV4 payload signing
            DisablePayloadSigning = true,
        };

        // Determine the content type based on file extension
        var extension = Path.GetExtension(localFilePath).ToLowerInvariant();
        request.ContentType = extension switch
        {
            ".pdf" => "application/pdf",
            ".svg" => "image/svg+xml",
            ".json" => "application/json",
            _ => "application/octet-stream",
        };

        // Execute the upload asynchronously
        await _client.PutObjectAsync(request);
    }

    /// <inheritdoc/>
    public void Dispose() =>
        // Dispose the underlying S3 client
        _client.Dispose();
}
