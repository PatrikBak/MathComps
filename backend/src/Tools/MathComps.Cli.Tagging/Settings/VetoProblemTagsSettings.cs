using MathComps.Cli.Tagging.Commands;

namespace MathComps.Cli.Tagging.Settings;

/// <summary>
/// Unified settings for the <see cref="VetoProblemTagsCommand"/> command.
/// </summary>
public class VetoProblemTagsSettings
{
    /// <summary>
    /// Gemini settings for vetoing problem statement tags (Area/Goal/Type tags).
    /// </summary>
    public required CommandGeminiSettings VetoProblemStatementTags { get; set; }

    /// <summary>
    /// Gemini settings for vetoing problem solution tags (Technique tags).
    /// </summary>
    public required CommandGeminiSettings VetoProblemSolutionTags { get; set; }
}
