namespace MathComps.Domain.Contracts.Comments;

/// <summary>
/// The type of content that can be commented on.
/// </summary>
public enum CommentTargetType
{
    /// <summary>
    /// A handout (file-based content).
    /// </summary>
    Handout,

    /// <summary>
    /// A competition problem.
    /// </summary>
    Problem,

    /// <summary>
    /// A news article.
    /// </summary>
    News
}
