using MathComps.Infrastructure.Options;

namespace MathComps.Cli.Tagging.Settings;

/// <summary>
/// Unified settings for the <see cref="Commands.SuggestTagsCommand"/> command.
/// </summary>
public class SuggestTagsSettings
{
    /// <summary>
    /// Configuration section name used in appsettings.json for these settings.
    /// </summary>
    public const string SectionName = "SuggestTagsSettings";

    /// <summary>
    /// Gemini settings for the tag suggestion phase.
    /// </summary>
    public required AiModelConfig SuggestTags { get; set; }

    /// <summary>
    /// Gemini settings for the tag vetoing/filtering phase.
    /// </summary>
    public required AiModelConfig VetoTags { get; set; }

    /// <summary>
    /// The path to the tag rules file that is shared between both the suggest and veto prompts to avoid repetition.
    /// </summary>
    public required string TagRulesPath { get; set; }
}
