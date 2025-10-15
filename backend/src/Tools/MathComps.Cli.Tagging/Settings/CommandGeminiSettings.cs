namespace MathComps.Cli.Tagging.Settings;

/// <summary>
/// Gemini settings that are specific to a single command.
/// </summary>
public class CommandGeminiSettings
{
    /// <summary>
    /// The specific AI model to use (e.g., "gemini-1.5-flash").
    /// </summary>
    public required string Model { get; set; }

    /// <summary>
    /// The path to the system prompt file.
    /// </summary>
    public required string SystemPromptPath { get; set; }
}
