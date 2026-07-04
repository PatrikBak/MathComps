namespace MathComps.Infrastructure.Options;

/// <summary>
/// Connection settings for the OpenRouter backend chat callers run against — an OpenAI-compatible aggregator that
/// routes one model id across hosting providers. The base URL and default model live in appsettings; the API key is
/// a secret and must come from user secrets.
/// </summary>
public class OpenRouterSettings
{
    /// <summary>
    /// The configuration section name.
    /// </summary>
    public const string SectionName = "OpenRouter";

    /// <summary>
    /// Base URL of the OpenAI-compatible endpoint, e.g. <c>https://openrouter.ai/api/v1</c>.
    /// </summary>
    public required string BaseUrl { get; set; }

    /// <summary>
    /// The default model requests run on unless a call overrides it, in OpenRouter's <c>vendor/model</c> form
    /// (e.g. <c>google/gemini-3.1-flash</c>).
    /// </summary>
    public required string Model { get; set; }

    /// <summary>
    /// The OpenRouter API key. Kept out of appsettings — set it in user secrets.
    /// </summary>
    public required string ApiKey { get; set; }

    /// <summary>
    /// The default reasoning-effort level requests use unless a call overrides it, as one of OpenRouter's levels
    /// (<c>xhigh</c>, <c>high</c>, <c>medium</c>, <c>low</c>, <c>minimal</c>, <c>none</c>); for Gemini 3 this maps to
    /// Google's thinking level. Null leaves reasoning off, so the request body carries no reasoning field at all.
    /// </summary>
    public string? ReasoningEffort { get; set; }
}
