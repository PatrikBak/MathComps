namespace MathComps.Domain.EfCoreEntities;

/// <summary>
/// One reply the examiner drafted on its way to a <see cref="DefenseTurn"/>, and every guard's verdict on it. A turn
/// is a loop, so it usually drafts more than once: the last attempt is the reply the student read and the earlier
/// ones were rejected, which makes the run the record of what the examiner tried and what each guard sent back.
/// </summary>
/// <remarks>
/// An attempt never outlives the turn it was drafted for: rewinding past that turn takes its attempts with it, as
/// does deleting the whole conversation. This is conversation content, not a spend fact, so it deliberately does not
/// share <see cref="DefenseSpend"/>'s independence from the session.
/// </remarks>
public class DefenseTurnAttempt
{
    /// <summary>
    /// Primary key (Guid v7).
    /// </summary>
    public Guid Id { get; set; } = Guid.CreateVersion7();

    /// <summary>
    /// The session the attempt was drafted in.
    /// </summary>
    public required Guid SessionId { get; set; }

    /// <summary>
    /// Navigation to the session.
    /// </summary>
    public DefenseSession Session { get; set; } = null!;

    /// <summary>
    /// The turn this attempt was drafted for.
    /// </summary>
    public required Guid TurnId { get; set; }

    /// <summary>
    /// Navigation to the turn.
    /// </summary>
    public DefenseTurn Turn { get; set; } = null!;

    /// <summary>
    /// The attempt's place in the turn's run, 0-based, giving a deterministic order.
    /// </summary>
    public required int AttemptIndex { get; set; }

    /// <summary>
    /// The drafted reply.
    /// </summary>
    /// <remarks>
    /// On the last attempt this is what the turn shipped, so it repeats <see cref="DefenseTurn.Content"/> rather than
    /// being read from it: an attempt that only sometimes carries its own text would be a worse row than a redundant
    /// one.
    /// </remarks>
    public required string Reply { get; set; }

    /// <summary>
    /// The flaw the generator was told to fix, or empty on the turn's first attempt.
    /// </summary>
    public required string RevisionNote { get; set; }

    /// <summary>
    /// Whether every mathematical claim the reply asserts held against the reference.
    /// </summary>
    public required bool MathHolds { get; set; }

    /// <summary>
    /// Which claim was wrong and what the correct statement is, when one failed; empty when they all held.
    /// </summary>
    public required string MathCorrection { get; set; }

    /// <summary>
    /// Whether the reply handed the candidate progress they should have reached themselves.
    /// </summary>
    public required bool Leaks { get; set; }

    /// <summary>
    /// The specific step or idea given away, when it leaked; empty when nothing did.
    /// </summary>
    public required string WhatLeaked { get; set; }

    /// <summary>
    /// Whether the reply kept demanding more although the candidate's solution was already complete.
    /// </summary>
    public required bool WithholdsClose { get; set; }

    /// <summary>
    /// The complete argument the candidate had assembled, when the close was withheld; empty otherwise.
    /// </summary>
    public required string Established { get; set; }

    /// <summary>
    /// Whether the reply was written in a different language from the candidate's latest turn.
    /// </summary>
    public required bool SwitchesLanguage { get; set; }

    /// <summary>
    /// The language the candidate's latest turn was written in, named in English.
    /// </summary>
    public required string CandidateLanguage { get; set; }

    /// <summary>
    /// Whether this attempt is the constrained fallback, drafted under a note that retreats rather than a correction,
    /// after the revision cap ran out with the reply still flagged.
    /// </summary>
    public required bool IsSafeFallback { get; set; }

    /// <summary>
    /// When the attempt was recorded, which is when its turn was.
    /// </summary>
    public required DateTimeOffset CreatedAt { get; set; }

    /// <summary>
    /// How long the attempt took end to end, in milliseconds: drafting the reply, then judging it. The guards judge
    /// concurrently, so this is shorter than its calls add up to. 0 on an attempt recorded before the timings were
    /// kept.
    /// </summary>
    public required int DurationMs { get; set; }

    /// <summary>
    /// The model calls this attempt made.
    /// </summary>
    public List<DefenseAttemptCall> Calls { get; set; } = [];
}
