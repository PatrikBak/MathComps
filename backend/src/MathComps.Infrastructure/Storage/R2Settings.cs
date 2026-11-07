using System.ComponentModel.DataAnnotations;

namespace MathComps.Infrastructure.Storage;

/// <summary>
/// The connection details of a Cloudflare R2 account and its buckets: the public one every visitor's browser
/// reads straight from, and the private one only the application reaches. A host names only the buckets it uses: a
/// bucket's name is required once something reaches for that bucket.
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
    /// The public bucket's name.
    /// </summary>
    public string PublicBucketName { get; set; } = string.Empty;

    /// <summary>
    /// The private bucket's name.
    /// </summary>
    public string PrivateBucketName { get; set; } = string.Empty;

    /// <summary>
    /// The access key ID for authenticating with R2, reaching every bucket the host names.
    /// </summary>
    [Required]
    public required string AccessKeyId { get; set; }

    /// <summary>
    /// The secret access key for authenticating with R2.
    /// </summary>
    [Required]
    public required string SecretAccessKey { get; set; }
}
