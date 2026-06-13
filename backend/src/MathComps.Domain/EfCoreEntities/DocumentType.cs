namespace MathComps.Domain.EfCoreEntities;

/// <summary>
/// Represents the type of document text.
/// </summary>
public enum DocumentType
{
    /// <summary>
    /// Problem statement text.
    /// </summary>
    Statement = 0,

    /// <summary>
    /// Problem solution text.
    /// </summary>
    Solution = 1
}
