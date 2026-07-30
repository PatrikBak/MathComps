namespace MathComps.Domain.EfCoreEntities;

/// <summary>
/// What the examiner did for the student over one defense conversation, as they call it. Deliberately an outcome
/// rather than a rating: a defense that ends unpleasantly can be the one that worked, so satisfaction would
/// measure the wrong thing. Every member sits on the one axis of what she did, so no two are true at once, and
/// <see cref="SomethingElse"/> closes the axis off so every conversation has a place to land.
/// </summary>
/// <remarks>
/// Two things the named members can't say, worth knowing before reading their counts. None of them reports her
/// giving too much away, while two ask for more help, so the tally leans toward being more forthcoming whatever
/// the truth is. And <see cref="ConfirmedTheSolution"/> also collects the students she never challenged on a
/// broken solution, since at the moment they answer they believe it holds.
/// </remarks>
public enum DefenseOutcome
{
    /// <summary>
    /// She found a mistake or an imprecision the student hadn't seen.
    /// </summary>
    FoundTheMistake,

    /// <summary>
    /// She probed the solution and turned nothing up, leaving the student surer of it.
    /// </summary>
    ConfirmedTheSolution,

    /// <summary>
    /// She held back more than the student needed from her.
    /// </summary>
    NotEnoughHelp,

    /// <summary>
    /// She was beside the point, whatever the student was trying to do.
    /// </summary>
    WasOff,

    /// <summary>
    /// The conversation went somewhere the rest of the list doesn't name, which is why an answer picking it
    /// carries the student's own account of where.
    /// </summary>
    SomethingElse,
}
