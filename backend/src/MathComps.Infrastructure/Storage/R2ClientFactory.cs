using Amazon.S3;

namespace MathComps.Infrastructure.Storage;

/// <summary>
/// Builds the S3 client both halves of the R2 integration talk through, so the endpoint shape and the
/// addressing quirks R2 needs are stated once.
/// </summary>
internal static class R2ClientFactory
{
    /// <summary>
    /// Creates an S3 client pointed at an R2 account, authenticated with its credentials.
    /// </summary>
    /// <param name="settings">R2 connection settings.</param>
    /// <returns>The client, owned by the caller.</returns>
    public static AmazonS3Client Create(R2Settings settings)
    {
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
        return new AmazonS3Client(settings.AccessKeyId, settings.SecretAccessKey, config);
    }
}
