namespace MathComps.Infrastructure.Services.Comments;

/// <summary>
/// The thread a comment belongs to, by the ids its link points at. Each <see cref="ICommentThreadKind"/> names its
/// threads with its own anchor.
/// </summary>
public abstract record CommentAnchor;
