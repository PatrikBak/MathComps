namespace MathComps.Infrastructure.Options;

/// <summary>
/// Connection settings for the shared chat callers run against — an OpenAI-compatible endpoint. The base URL lives
/// in appsettings; the API key is a secret and must come from user secrets. The model
/// and reasoning level are per-call, not connection-wide, so they live on each call's <see cref="ChatStepSettings"/>.
/// </summary>
public class LlmSettings
{
    /// <summary>
    /// The configuration section name.
    /// </summary>
    public const string SectionName = "Llm";

    /// <summary>
    /// Base URL of the OpenAI-compatible endpoint the shared chat stack calls.
    /// </summary>
    public required string BaseUrl { get; set; }

    /// <summary>
    /// The API key for the configured endpoint. Kept out of appsettings — set it in user secrets.
    /// </summary>
    public required string ApiKey { get; set; }

    /// <summary>
    /// How many times a failed call is re-issued before giving up; the first attempt plus this many is the total tries.
    /// </summary>
    public required int MaxRetries { get; set; }

    /// <summary>
    /// The base delay a retry waits before re-issuing the call.
    /// </summary>
    public required TimeSpan RetryDelay { get; set; }
}
