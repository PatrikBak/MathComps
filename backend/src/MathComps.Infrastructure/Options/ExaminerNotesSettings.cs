namespace MathComps.Infrastructure.Options;

/// <summary>
/// Paths to the notes the examiner reads: the instructions a flagged reply is sent back under, and the guidance
/// for a reference that carries the author's hints. Each note is its own file, so its wording is swapped per run
/// through configuration.
/// </summary>
public class ExaminerNotesSettings
{
    /// <summary>
    /// Path to the note every revision instruction is written into, marking the whole thing to the generator as an
    /// instruction to follow. Carries a <c>{notes}</c> placeholder for the instructions a turn raised.
    /// </summary>
    public required string Revision { get; set; }

    /// <summary>
    /// Path to the instruction for a reply the math-check found a wrong claim in. Carries a <c>{correction}</c>
    /// placeholder for what the checker said is true instead.
    /// </summary>
    public required string WrongClaim { get; set; }

    /// <summary>
    /// Path to the instruction for a reply the leak-check found hands away earned progress. Carries a
    /// <c>{what_leaked}</c> placeholder for what the checker said was given away.
    /// </summary>
    public required string Leak { get; set; }

    /// <summary>
    /// Path to the instruction for a reply that keeps pressing a candidate whose solution is already complete.
    /// </summary>
    public required string WithheldClose { get; set; }

    /// <summary>
    /// Path to the instruction for a reply that drifted out of the candidate's language.
    /// </summary>
    public required string LanguageSwitch { get; set; }

    /// <summary>
    /// Path to the instruction a draft that outlasted the revision cap is replaced under: a holding reply constrained
    /// to assert and reveal nothing.
    /// </summary>
    public required string SafeHold { get; set; }

    /// <summary>
    /// Path to the guidance for using the author's staged hints.
    /// </summary>
    public required string AuthorHints { get; set; }
}
