namespace MathComps.Domain.EfCoreEntities;

/// <summary>
/// Where an <see cref="OutgoingMail"/> stands.
/// </summary>
public enum OutgoingMailStatus
{
    /// <summary>
    /// Waiting for its next attempt.
    /// </summary>
    Pending,

    /// <summary>
    /// Went.
    /// </summary>
    Sent,

    /// <summary>
    /// Failed every attempt it was allowed, and was given up on.
    /// </summary>
    Failed,
}
