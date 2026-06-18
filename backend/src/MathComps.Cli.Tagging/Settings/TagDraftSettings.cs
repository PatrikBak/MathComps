using MathComps.Domain.EfCoreEntities;

namespace MathComps.Cli.Tagging.Settings;

/// <summary>
/// Settings for the <see cref="Commands.TagDraftCommand"/> command — the prompt template for each of the four
/// passes and the fit floor.
/// </summary>
public class TagDraftSettings
{
    /// <summary>
    /// Configuration section name used in appsettings.json for these settings.
    /// </summary>
    public const string SectionName = "TagDraftSettings";

    /// <summary>
    /// Prompt path for the generate pass over the statement (Area/Goal/Type tags).
    /// </summary>
    public required string GenerateStatement { get; set; }

    /// <summary>
    /// Prompt path for the generate pass over the solution (Technique tags).
    /// </summary>
    public required string GenerateSolution { get; set; }

    /// <summary>
    /// Prompt path for the veto pass reviewing the statement's proposed Area/Goal/Type tags.
    /// </summary>
    public required string VetoStatement { get; set; }

    /// <summary>
    /// Prompt path for the veto pass reviewing the solution's proposed Technique tags.
    /// </summary>
    public required string VetoSolution { get; set; }

    /// <summary>
    /// Generate-pass fitness floor: only slugs scoring at least this reach the veto pass, so marginal guesses never
    /// approach the draft. Defaults to the domain's visibility threshold.
    /// </summary>
    public float FitFloor { get; set; } = ProblemTag.MinimumGoodnessOfFitThreshold;
}
