using MathComps.Cli.Tagging.Commands;

namespace MathComps.Cli.Tagging.Settings;

/// <summary>
/// Unified settings for the <see cref="SuggestTagsCommand"/> command.
/// </summary>
public class SuggestTagsSettings
{
    /// <summary>
    /// Gemini settings for the tag suggestion phase.
    /// </summary>
    public required CommandGeminiSettings SuggestTags { get; set; }

    /// <summary>
    /// Gemini settings for the tag vetoing/filtering phase.
    /// </summary>
    public required CommandGeminiSettings VetoTags { get; set; }

    /// <summary>
    /// The path to the tag rules file that is shared between both the suggest and veto prompts to avoid repetition.
    /// </summary>
    public required string TagRulesPath { get; set; }
}
