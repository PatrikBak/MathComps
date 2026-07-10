namespace MathComps.Infrastructure.Options;

/// <summary>
/// Configures one prompted model call: which prompt template it runs, and the model and reasoning level it runs on.
/// A chat pipeline binds one per step, so each step is tuned independently.
/// </summary>
public class ChatStepSettings
{
    /// <summary>
    /// Path to the step's prompt template.
    /// </summary>
    public required string Prompt { get; set; }

    /// <summary>
    /// The model this step runs on, in OpenRouter's <c>vendor/model</c> form (e.g. <c>google/gemini-3.1-flash</c>).
    /// </summary>
    public required string Model { get; set; }

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
