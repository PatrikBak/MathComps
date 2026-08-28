namespace MathComps.Infrastructure.Options;

/// <summary>
/// Options for the competitions the site hosts itself.
/// </summary>
public class HostedCompetitionOptions
{
    /// <summary>
    /// The name of the configuration section for hosted competition options.
    /// </summary>
    public const string ConfigurationSectionName = "HostedCompetitions";

    /// <summary>
    /// How long after an entry ends a student may still say something about their own solutions, in minutes.
    /// </summary>
    /// <remarks>
    /// Zero closes the window with the entry.
    ///
    /// The copy telling students how long they have names this in words rather than reading it, so moving it
    /// means moving <c>selfAssessmentNote</c> and <c>selfAssessmentPracticeNote</c> in all three locales too.
    /// </remarks>
    public int NoteGraceMinutes { get; set; } = 30;
}
