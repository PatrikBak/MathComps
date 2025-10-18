using MathComps.Cli.Tagging.Commands;

namespace MathComps.Cli.Tagging.Settings;

/// <summary>
/// Unified settings for the <see cref="TagProblemsCommand"/> command.
/// </summary>
public class TagProblemsSettings
{
    /// <summary>
    /// Gemini settings for tagging problems based on statement only (Area/Goal/Type tags).
    /// </summary>
    public required CommandGeminiSettings TagProblemStatement { get; set; }

    /// <summary>
    /// Gemini settings for tagging problems based on statement and solution (Technique tags).
    /// </summary>
    public required CommandGeminiSettings TagProblemSolution { get; set; }
}
