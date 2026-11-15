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
    Solution = 1,

    /// <summary>
    /// The author's hint ladder, every hint in one document in the shape <see cref="HintsDocument"/> defines.
    /// </summary>
    Hints = 2,

    /// <summary>
    /// The author's note for marking the problem: what a solution owes a reason for and what it needs none for. It is
    /// kept from students, and a problem carries at most one, in a single language whatever language a student reads
    /// in.
    /// </summary>
    GradingNote = 3
}
