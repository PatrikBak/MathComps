namespace MathComps.Domain.Contracts.Admin;

/// <summary>
/// A new mark for a grade, wrapped so that taking the mark back can be told apart from leaving it alone.
/// </summary>
/// <param name="Value">The mark, or null to take it back.</param>
public record GradeMarkChange(int? Value);
