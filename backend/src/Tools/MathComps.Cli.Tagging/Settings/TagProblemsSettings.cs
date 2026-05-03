using MathComps.Infrastructure.Options;

namespace MathComps.Cli.Tagging.Settings;

/// <summary>
/// Unified settings for the <see cref="Commands.TagProblemsCommand"/> command.
/// </summary>
public class TagProblemsSettings
{
    /// <summary>
    /// Configuration section name used in appsettings.json for these settings.
    /// </summary>
    public const string SectionName = "TagProblemsSettings";

    /// <summary>
    /// Gemini settings for tagging problems based on statement only (Area/Goal/Type tags).
    /// </summary>
    public required AiModelConfig TagProblemStatement { get; set; }

    /// <summary>
    /// Gemini settings for tagging problems based on statement and solution (Technique tags).
    /// </summary>
    public required AiModelConfig TagProblemSolution { get; set; }
}
