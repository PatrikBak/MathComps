using MathComps.Infrastructure.Options;

namespace MathComps.Cli.Translation.Settings;

/// <summary>
/// Configuration settings for the translate problems command.
/// </summary>
public class TranslateProblemsSettings
{
    /// <summary>
    /// AI model configuration for the translation command.
    /// </summary>
    public required AiModelConfig ModelConfig { get; set; }
}
