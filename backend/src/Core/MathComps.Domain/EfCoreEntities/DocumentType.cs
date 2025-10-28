namespace MathComps.Domain.EfCoreEntities;

/// <summary>
/// Represents the type of document being embedded.
/// </summary>
public enum DocumentType
{
    /// <summary>
    /// Only the problem statement is embedded.
    /// </summary>
    ProblemStatement = 0,

    /// <summary>
    /// Both the problem statement and solution are embedded together.
    /// </summary>
    ProblemWithSolution = 1
}
