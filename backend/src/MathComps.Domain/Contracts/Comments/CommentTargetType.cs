namespace MathComps.Domain.Contracts.Comments;

/// <summary>
/// The kind of target a comment thread belongs to.
/// </summary>
public enum CommentTargetType
{
    /// <summary>
    /// A handout.
    /// </summary>
    Handout,

    /// <summary>
    /// A competition problem.
    /// </summary>
    Problem,

    /// <summary>
    /// A news article.
    /// </summary>
    News,

    /// <summary>
    /// The conversation between the graders and one student about one problem the student was graded on,
    /// identified as <c>{problemId}:{userId}</c>.
    /// </summary>
    HostedGrade
}
