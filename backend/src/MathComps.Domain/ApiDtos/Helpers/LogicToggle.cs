namespace MathComps.Domain.ApiDtos.Helpers;

/// <summary>
/// Logical operator to combine multiple selected values within a single facet (e.g., tags, authors).
/// </summary>
public enum LogicToggle
{
    /// <summary>
    /// Match any selected value (logical OR).
    /// </summary>
    Or = 0,

    /// <summary>
    /// Match all selected values (logical AND).
    /// </summary>
    And = 1,
}
