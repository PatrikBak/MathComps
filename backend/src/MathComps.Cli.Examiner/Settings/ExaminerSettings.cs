using MathComps.Infrastructure.Options;

namespace MathComps.Cli.Examiner.Settings;

/// <summary>
/// Settings for the examiner loop: the model configuration for each of its three steps, plus the revision cap.
/// </summary>
public class ExaminerSettings
{
    /// <summary>
    /// Configuration section name used in appsettings.json for these settings.
    /// </summary>
    public const string SectionName = "Examiner";

    /// <summary>
    /// The generate step: writes the examiner's next reply to the candidate.
    /// </summary>
    public required ChatStepSettings Generate { get; set; }

    /// <summary>
    /// The math-check step: finds the claims the reply makes and verifies each against the reference.
    /// </summary>
    public required ChatStepSettings MathCheck { get; set; }

    /// <summary>
    /// The leak-check step: scans the reply, in the context of the whole transcript, for over-explaining.
    /// </summary>
    public required ChatStepSettings LeakCheck { get; set; }

    /// <summary>
    /// How many times a flagged reply is regenerated before the last attempt ships regardless. The cap stops a
    /// stubborn flaw or noisy checker from looping forever.
    /// </summary>
    public required int MaxRevisions { get; set; }
}
