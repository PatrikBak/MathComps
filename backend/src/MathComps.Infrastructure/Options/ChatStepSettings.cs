namespace MathComps.Infrastructure.Options;

/// <summary>
/// Configures one prompted model call: which prompt template it runs, and the routing and limits it runs under.
/// A chat pipeline binds one per step, so each step is tuned independently.
/// </summary>
public class ChatStepSettings
{
    /// <summary>
    /// Path to the step's prompt template.
    /// </summary>
    public required string Prompt { get; set; }

    /// <summary>
    /// The model this step runs on, in <c>vendor/model</c> form (e.g. <c>google/gemini-3.1-flash</c>).
    /// </summary>
    public required string Model { get; set; }

    /// <summary>
    /// Backup models the endpoint tries in order when this step's <see cref="Model"/> fails on the provider's side:
    /// an outage, a rate limit, an error. Each in <c>vendor/model</c> form. Empty sends no fallback field at all, so
    /// the call rides on the primary alone.
    /// </summary>
    public IReadOnlyList<string> FallbackModels { get; set; } = [];

    /// <summary>
    /// The reasoning-effort level this step runs at, or null to send no reasoning field at all.
    /// </summary>
    public string? ReasoningEffort { get; set; }

    /// <summary>
    /// A cap on the step's output tokens, reasoning included, or null for the model's default. Bounds a runaway
    /// generation that would otherwise run to the model's ceiling. On budget-based thinking models the reasoning
    /// budget derives from this cap, so it also tunes the step's thinking depth.
    /// </summary>
    public int? MaxOutputTokens { get; set; }
}
