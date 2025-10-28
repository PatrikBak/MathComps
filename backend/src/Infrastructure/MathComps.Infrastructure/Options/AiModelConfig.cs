namespace MathComps.Infrastructure.Options;

/// <summary>
/// AI model configuration for a specific command execution.
/// </summary>
public class AiModelConfig
{
    /// <summary>
    /// The specific AI model to use (e.g., "gemini-1.5-flash").
    /// </summary>
    public required string Model { get; set; }

    /// <summary>
    /// The path to the system prompt file.
    /// </summary>
    public required string SystemPromptPath { get; set; }

    /// <summary>
    /// Controls the number of thinking tokens for AI reasoning. Higher values enable more detailed analysis for complex tasks.
    /// Use 0 to disable thinking, -1 for dynamic thinking, or a positive number for fixed budget.
    /// </summary>
    public required int ThinkingBudget { get; set; }
}
