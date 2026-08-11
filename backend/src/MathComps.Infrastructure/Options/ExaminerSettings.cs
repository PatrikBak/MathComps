using System.ComponentModel.DataAnnotations;

namespace MathComps.Infrastructure.Options;

/// <summary>
/// Settings for the examiner loop: the model configuration for each of its steps, plus the revision cap. The
/// annotations make a missing <c>Examiner</c> section fail validation at startup rather than leaving a step null and
/// faulting on the first turn.
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
    [Required]
    public required ChatStepSettings Generate { get; set; }

    /// <summary>
    /// The math-check step: finds the claims the reply makes and verifies each against the reference.
    /// </summary>
    [Required]
    public required ChatStepSettings MathCheck { get; set; }

    /// <summary>
    /// The leak-check step: scans the reply, in the context of the whole transcript, for over-explaining.
    /// </summary>
    [Required]
    public required ChatStepSettings LeakCheck { get; set; }

    /// <summary>
    /// The language-check step: reads the reply against the candidate's latest turn alone and says whether it drifted
    /// out of their language.
    /// </summary>
    [Required]
    public required ChatStepSettings LanguageCheck { get; set; }

    /// <summary>
    /// How many times a flagged reply is regenerated before the last attempt ships regardless. The cap stops a
    /// stubborn flaw or noisy checker from looping forever.
    /// </summary>
    [Range(0, int.MaxValue)]
    public required int MaxRevisions { get; set; }
}
