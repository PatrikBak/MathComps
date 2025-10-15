using System.ComponentModel.DataAnnotations;

namespace MathComps.Cli.Similarity.Settings;

/// <summary>
/// Configuration settings for the external embedding service that generates vector representations.
/// </summary>
public class EmbeddingServiceSettings
{
    /// <summary>
    /// Configuration section name used in appsettings.json for these settings.
    /// </summary>
    public const string SectionName = "EmbeddingService";

    /// <summary>
    /// Base URL for the embedding service API endpoint.
    /// Should include protocol, host, and port (e.g., http://localhost:8000).
    /// </summary>
    [Required]
    public required string BaseUrl { get; set; }

    /// <summary>
    /// Timeout in seconds for HTTP requests to the embedding service.
    /// Should be sufficient for embedding generation while preventing long hangs.
    /// </summary>
    [Range(1, 300)]
    public int TimeoutSeconds { get; set; }
}
