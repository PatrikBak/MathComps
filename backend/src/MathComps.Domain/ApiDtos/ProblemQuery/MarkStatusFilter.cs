namespace MathComps.Domain.ApiDtos.ProblemQuery;

/// <summary>
/// Filter mode for problem mark status. Used as a query parameter to filter problems by their mark state.
/// </summary>
public enum MarkStatusFilter
{
    /// <summary>
    /// Show only problems marked by the current user.
    /// </summary>
    Marked,

    /// <summary>
    /// Show only problems not marked by the current user.
    /// </summary>
    Unmarked
}
