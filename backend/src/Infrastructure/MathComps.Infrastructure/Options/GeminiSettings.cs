namespace MathComps.Infrastructure.Options;

/// <summary>
/// Configuration settings for the Gemini API.
/// </summary>
public class GeminiSettings
{
    /// <summary>
    /// The configuration section name.
    /// </summary>
    public const string SectionName = "Gemini";

    /// <summary>
    /// The API key for accessing the Gemini service.
    /// </summary>
    public required string ApiKey { get; set; }

    /// <summary>
    /// Timeout for AI API requests in seconds. AI prompts can take up long, this includes API latency too.
    /// The default 100 seconds seem to fail sometime.
    /// </summary>
    public int TimeoutSeconds { get; set; } = 300;
}
