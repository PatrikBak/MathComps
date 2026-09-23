namespace MathComps.Domain.Contracts.Admin;

/// <summary>
/// A flaw one of the examiner's guards can catch in a reply it drafted.
/// </summary>
public enum ExaminerFlaw
{
    /// <summary>
    /// A mathematical claim in the reply that does not hold against the reference.
    /// </summary>
    WrongClaim,

    /// <summary>
    /// Progress handed to the candidate that they should have reached themselves.
    /// </summary>
    Leak,

    /// <summary>
    /// More demanded of a candidate whose solution was already complete.
    /// </summary>
    WithheldClose,

    /// <summary>
    /// A reply written in a different language from the candidate's latest turn.
    /// </summary>
    LanguageSwitch,

    /// <summary>
    /// A word in the reply that took the candidate for a man or a woman.
    /// </summary>
    GenderedAddress,

    /// <summary>
    /// A reply that left the candidate's argument to walk them through the examiner's own.
    /// </summary>
    Route,
}
