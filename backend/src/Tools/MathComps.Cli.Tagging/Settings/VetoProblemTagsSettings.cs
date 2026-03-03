using MathComps.Infrastructure.Options;

namespace MathComps.Cli.Tagging.Settings;

/// <summary>
/// Unified settings for the <see cref="VetoProblemTagsCommand"/> command.
/// </summary>
public class VetoProblemTagsSettings
{
    /// <summary>
    /// Configuration section name used in appsettings.json for these settings.
    /// </summary>
    public const string SectionName = "VetoProblemTagsSettings";

    /// <summary>
    /// Gemini settings for vetoing problem statement tags (Area/Goal/Type tags).
    /// </summary>
    public required AiModelConfig VetoProblemStatementTags { get; set; }

    /// <summary>
    /// Gemini settings for vetoing problem solution tags (Technique tags).
    /// </summary>
    public required AiModelConfig VetoProblemSolutionTags { get; set; }
}
