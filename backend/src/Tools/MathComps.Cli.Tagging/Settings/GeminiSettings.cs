namespace MathComps.Cli.Tagging.Settings;

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
}
