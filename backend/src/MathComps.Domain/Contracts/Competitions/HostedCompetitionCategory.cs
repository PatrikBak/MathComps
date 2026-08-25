namespace MathComps.Domain.Contracts.Competitions;

/// <summary>
/// The levels a hosted group runs, easiest first. Each is a difficulty the student picks for themselves, and each
/// is one competition node of the taxonomy.
/// </summary>
public enum HostedCompetitionCategory
{
    /// <summary>
    /// The easiest level.
    /// </summary>
    Elementary = 0,

    /// <summary>
    /// The middle level.
    /// </summary>
    Intermediate = 1,

    /// <summary>
    /// The hardest level.
    /// </summary>
    Advanced = 2,
}
