using MathComps.Domain.EfCoreEntities;
using MathComps.Infrastructure.Options;

namespace MathComps.Cli.Tagging.Settings;

/// <summary>
/// Settings for the <see cref="Commands.TagDraftCommand"/> command — the four Gemini passes plus the fit floor.
/// </summary>
public class TagDraftSettings
{
    /// <summary>
    /// Configuration section name used in appsettings.json for these settings.
    /// </summary>
    public const string SectionName = "TagDraftSettings";

    /// <summary>
    /// Generate pass over the statement (Area/Goal/Type tags).
    /// </summary>
    public required AiModelConfig GenerateStatement { get; set; }

    /// <summary>
    /// Generate pass over the solution (Technique tags).
    /// </summary>
    public required AiModelConfig GenerateSolution { get; set; }

    /// <summary>
    /// Veto pass reviewing the statement's proposed Area/Goal/Type tags.
    /// </summary>
    public required AiModelConfig VetoStatement { get; set; }

    /// <summary>
    /// Veto pass reviewing the solution's proposed Technique tags.
    /// </summary>
    public required AiModelConfig VetoSolution { get; set; }

    /// <summary>
    /// Generate-pass fitness floor: only slugs scoring at least this reach the veto pass, so marginal guesses never
    /// approach the draft. Defaults to the domain's visibility threshold.
    /// </summary>
    public float FitFloor { get; set; } = ProblemTag.MinimumGoodnessOfFitThreshold;
}
