using System.ComponentModel.DataAnnotations;

namespace MathComps.Infrastructure.Storage;

/// <summary>
/// Configuration for <see cref="R2Uploader"/> that specifies Cloudflare R2 connection details.
/// </summary>
public class R2Settings
{
    /// <summary>
    /// Configuration section name used in appsettings.json for these settings.
    /// </summary>
    public const string SectionName = "CloudflareR2";

    /// <summary>
    /// The Cloudflare account ID used to construct the R2 endpoint URL.
    /// </summary>
    [Required]
    public required string AccountId { get; set; }

    /// <summary>
    /// The R2 bucket name to upload files to.
    /// </summary>
    [Required]
    public required string BucketName { get; set; }

    /// <summary>
    /// The access key ID for authenticating with R2.
    /// </summary>
    [Required]
    public required string AccessKeyId { get; set; }

    /// <summary>
    /// The secret access key for authenticating with R2.
    /// </summary>
    [Required]
    public required string SecretAccessKey { get; set; }
}
