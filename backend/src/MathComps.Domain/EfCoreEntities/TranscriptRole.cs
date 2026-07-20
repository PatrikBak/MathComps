namespace MathComps.Domain.EfCoreEntities;

/// <summary>
/// Who authored a defense-conversation turn.
/// </summary>
public enum TranscriptRole
{
    /// <summary>
    /// The student defending their solution.
    /// </summary>
    Candidate,

    /// <summary>
    /// The examiner probing it.
    /// </summary>
    Examiner,
}
