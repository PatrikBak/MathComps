namespace MathComps.Domain.EfCoreEntities;

/// <summary>
/// Which reaction a <see cref="CommentReaction"/> is.
/// </summary>
public enum CommentReactionKind
{
    /// <summary>
    /// 👍, agreeing with the comment.
    /// </summary>
    ThumbsUp,

    /// <summary>
    /// 👎, disagreeing with the comment.
    /// </summary>
    ThumbsDown,
}
