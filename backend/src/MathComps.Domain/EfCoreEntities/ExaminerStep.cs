namespace MathComps.Domain.EfCoreEntities;

/// <summary>
/// One step of the examiner's turn: the model call that writes the reply, or one of the guards that judges it. Each
/// routes to its own model and reasoning level, so this is the axis a turn's cost and latency break down along.
/// </summary>
public enum ExaminerStep
{
    /// <summary>
    /// Writes the examiner's next reply to the candidate.
    /// </summary>
    Generate,

    /// <summary>
    /// Verifies every mathematical claim the reply asserts against the reference.
    /// </summary>
    MathCheck,

    /// <summary>
    /// Judges whether the reply mis-pays the progress the candidate has earned.
    /// </summary>
    LeakCheck,

    /// <summary>
    /// Judges whether the reply is written in the language the candidate is writing in.
    /// </summary>
    LanguageCheck,
}
