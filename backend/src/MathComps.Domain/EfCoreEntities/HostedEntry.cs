namespace MathComps.Domain.EfCoreEntities;

/// <summary>
/// One student's entry into one round of a hosted group: what they spent to reach the problems, and the window
/// their work against them counts in.
/// </summary>
/// <remarks>
/// An entry is spent in one of two ways. <see cref="StartedAt"/> is set on an entry the student sat, and their
/// clock runs from it; <see cref="ForfeitedAt"/> is set on one they gave up to read the problems, which no clock
/// belongs to. Exactly one of the two is ever set.
///
/// One row per student per round. Where a group allows re-entry, taking it again resets this row rather than
/// adding a second: what a student did in an earlier run is their conversations, and those hang off the problem
/// rather than off the entry, so the only thing a reset drops is the clock the earlier run was measured by.
/// </remarks>
public class HostedEntry
{
    /// <summary>
    /// Primary key (Guid v7).
    /// </summary>
    public Guid Id { get; set; } = Guid.CreateVersion7();

    /// <summary>
    /// The student whose entry this is.
    /// </summary>
    public required Guid UserId { get; set; }

    /// <summary>
    /// Navigation to the student.
    /// </summary>
    public User User { get; set; } = null!;

    /// <summary>
    /// The round entered, which is one category of one group.
    /// </summary>
    public required Guid RoundId { get; set; }

    /// <summary>
    /// Navigation to the round.
    /// </summary>
    public Round Round { get; set; } = null!;

    /// <summary>
    /// When the student entered, which is when their clock started; null on an entry they gave up instead.
    /// </summary>
    public DateTimeOffset? StartedAt { get; set; }

    /// <summary>
    /// When the student closed the entry themselves, or null while they have not.
    /// </summary>
    /// <remarks>
    /// Says nothing on its own about whether they handed in early: what separates a hand-in from a clock running
    /// out is whether this sits before the clock would have ended the entry anyway.
    /// </remarks>
    public DateTimeOffset? FinishedAt { get; set; }

    /// <summary>
    /// When the student gave the entry up to read the problems; null on an entry they sat.
    /// </summary>
    public DateTimeOffset? ForfeitedAt { get; set; }
}
