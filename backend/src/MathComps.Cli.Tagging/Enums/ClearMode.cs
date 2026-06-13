namespace MathComps.Cli.Tagging.Enums;

/// <summary>
/// Specifies which tags should be cleared before tagging.
/// </summary>
public enum ClearMode
{
    /// <summary>
    /// Do not clear any tags before tagging.
    /// </summary>
    None,

    /// <summary>
    /// Clear only assigned tags (tags with <see cref="Domain.EfCoreEntities.ProblemTag.GoodnessOfFit"/> 
    /// greater than or equal to <see cref="Domain.EfCoreEntities.ProblemTag.MinimumGoodnessOfFitThreshold"/>).
    /// </summary>
    OnlyAssigned,

    /// <summary>
    /// Clear both assigned and unassigned tags (i.e. the history with information about why tag
    /// was not assigned etc).
    /// </summary>
    AssignedAndUnassigned
}

