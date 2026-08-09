namespace MathComps.Domain.EfCoreEntities;

/// <summary>
/// What went wrong with one examiner reply. Each member names a different thing to go and fix rather than a
/// different way to be annoyed. Shared by the student's own <see cref="DefenseTurnReport"/> and the
/// <see cref="AdminNote"/> written while reviewing, so both authors' findings count on one axis.
/// </summary>
public enum DefenseReportCategory
{
    /// <summary>
    /// The reply answers something other than what the student argued.
    /// </summary>
    Misunderstood,

    /// <summary>
    /// The reply asserts something untrue, whether about the mathematics, the student's solution, or the problem.
    /// </summary>
    SaidSomethingWrong,

    /// <summary>
    /// The reply handed over more of the solution than the student had earned.
    /// </summary>
    GaveAway,

    /// <summary>
    /// The reply let a flaw in the student's argument stand.
    /// </summary>
    MissedTheMistake,

    /// <summary>
    /// The reply's manner is off, however sound its content.
    /// </summary>
    Tone,

    /// <summary>
    /// Something the rest of the list doesn't cover, which is why a report naming it carries the student's own
    /// account of what happened.
    /// </summary>
    Other,
}
