namespace MathComps.Domain.EfCoreEntities;

/// <summary>
/// When one reviewer last read a <see cref="DefenseSession"/>. Read state belongs to whoever did the reading, so a
/// conversation carries one of these per reviewer and the absence of one means that reviewer has never read it.
/// </summary>
/// <remarks>
/// Whether a conversation is unread is derived by comparing this against its newest turn rather than stored as a
/// flag, so a student carrying the conversation on brings it back to be read again. That comparison is against a
/// time and not a turn's sequence on purpose: a rewind drops the turns above a sequence and later ones reuse those
/// numbers, which would let turns nobody has read sit under an already-read high-water mark.
/// </remarks>
public class AdminSessionReview
{
    /// <summary>
    /// The conversation that was read.
    /// </summary>
    public required Guid SessionId { get; set; }

    /// <summary>
    /// Navigation to the conversation.
    /// </summary>
    public DefenseSession Session { get; set; } = null!;

    /// <summary>
    /// The reviewer who read it, as against the student who held the conversation.
    /// </summary>
    public required Guid ReviewerId { get; set; }

    /// <summary>
    /// Navigation to the reviewer.
    /// </summary>
    public User Reviewer { get; set; } = null!;

    /// <summary>
    /// When they last read it.
    /// </summary>
    public required DateTimeOffset ReadAt { get; set; }
}
