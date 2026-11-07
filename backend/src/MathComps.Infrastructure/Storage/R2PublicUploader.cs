using System.Net.Mime;
using Microsoft.Extensions.Options;

namespace MathComps.Infrastructure.Storage;

/// <summary>
/// The <see cref="IFileUploader"/> into the public Cloudflare R2 bucket, through an <see cref="R2Bucket"/>. Each file
/// goes up with the media type its extension names and the caching that visitors reading it straight from the bucket
/// get.
/// </summary>
/// <param name="r2Settings">The R2 connection settings, naming the public bucket.</param>
public sealed class R2PublicUploader(IOptions<R2Settings> r2Settings) : IFileUploader, IDisposable
{
    /// <inheritdoc/>
    public string StoreName { get; } = r2Settings.Value.PublicBucketName;

    /// <summary>
    /// The public bucket the files go to.
    /// </summary>
    private readonly R2Bucket _bucket =
        new(r2Settings.Value, r2Settings.Value.PublicBucketName, nameof(R2Settings.PublicBucketName));

    /// <inheritdoc/>
    public async Task UploadAsync(string localFilePath, string key)
    {
        // How a visitor may cache the file: a short fresh window plus a long stale-while-revalidate, so an edit
        // reaches everyone within a minute while the cache stays useful between edits
        const string cacheControl = "public, max-age=60, stale-while-revalidate=86400";

        // The file's bytes
        await using var file = File.OpenRead(localFilePath);

        // Store them with the media type the extension names
        await _bucket.PutAsync(key, file, ContentTypeOf(localFilePath), cacheControl, CancellationToken.None);
    }

    /// <inheritdoc/>
    public void Dispose() =>
        // Dispose the bucket's client
        _bucket.Dispose();

    /// <summary>
    /// The media type a file is uploaded with, by its extension.
    /// </summary>
    /// <param name="localFilePath">The file's path.</param>
    /// <returns>The media type, or a generic binary one for an extension not listed.</returns>
    private static string ContentTypeOf(string localFilePath) =>
        Path.GetExtension(localFilePath).ToLowerInvariant() switch
        {
            ".pdf" => MediaTypeNames.Application.Pdf,
            ".svg" => MediaTypeNames.Image.Svg,
            ".png" => MediaTypeNames.Image.Png,
            ".jpg" or ".jpeg" => MediaTypeNames.Image.Jpeg,
            ".webp" => MediaTypeNames.Image.Webp,
            ".json" => MediaTypeNames.Application.Json,
            _ => MediaTypeNames.Application.Octet,
        };
}
