namespace MathComps.Domain.EfCoreEntities;

/// <summary>
/// What the examiner did for the student over one defense conversation, as they call it. Deliberately an outcome
/// rather than a rating: a defense that ends unpleasantly can be the one that worked, so satisfaction would
/// measure the wrong thing. Every member sits on the one axis of what she did, and
/// <see cref="SomethingElse"/> closes the axis off so every conversation has a place to land.
/// </summary>
public enum DefenseOutcome
{
    /// <summary>
    /// She found a mistake or an imprecision the student hadn't seen.
    /// </summary>
    FoundTheMistake,

    /// <summary>
    /// She probed the solution and turned nothing up, leaving the student surer of it. Also covers a broken
    /// solution she never challenged, since at the moment the student answers they believe it holds.
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
