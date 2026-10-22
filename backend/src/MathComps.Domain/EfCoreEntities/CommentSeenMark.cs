using MathComps.Domain.Contracts.Comments;

namespace MathComps.Domain.EfCoreEntities;

/// <summary>
/// How far one reader has seen the whole discussion of one comment target: every top-level comment and every reply
/// posted on it up to a moment. A reader holds at most one per target, and the absence of one means they have seen
/// nothing in its discussion.
/// </summary>
/// <remarks>
/// Whether a comment is new to the reader is derived by comparing its posting time against this, never stored, so an
/// edit, which keeps the posting time, never makes a comment new again. The target is named by its type and id, so one
/// table serves every kind of target.
/// </remarks>
public class CommentSeenMark
{
    /// <summary>
    /// FK to the reader.
    /// </summary>
    public required Guid UserId { get; set; }

    /// <summary>
    /// Navigation to the reader.
    /// </summary>
    public User User { get; set; } = null!;

    /// <summary>
    /// The kind of target whose discussion was seen.
    /// </summary>
    public required CommentTargetType TargetType { get; set; }

    /// <summary>
    /// The id the target goes by within its kind.
    /// </summary>
    public required string TargetId { get; set; }

    /// <summary>
    /// The moment up to which the reader has seen every comment and reply posted on the target.
    /// </summary>
    public required DateTimeOffset SeenUpTo { get; set; }
}
