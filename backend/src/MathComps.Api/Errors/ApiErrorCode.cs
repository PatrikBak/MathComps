namespace MathComps.Api.Errors;

/// <summary>
/// Machine-readable identifier for a business failure, emitted in a problem response's <c>errorCode</c>
/// field. Each recognized domain exception is translated to one of these.
/// </summary>
public enum ApiErrorCode
{
    /// <summary>
    /// The referenced comment does not exist.
    /// </summary>
    CommentNotFound,

    /// <summary>
    /// The caller is not the author of the comment they tried to edit or delete.
    /// </summary>
    NotCommentAuthor,

    /// <summary>
    /// The caller tried to like their own comment.
    /// </summary>
    CannotLikeOwnComment,

    /// <summary>
    /// The content a comment is attached to does not exist.
    /// </summary>
    CommentTargetNotFound,

    /// <summary>
    /// The referenced problem does not exist.
    /// </summary>
    ProblemNotFound,

    /// <summary>
    /// The referenced user list does not exist.
    /// </summary>
    ListNotFound,

    /// <summary>
    /// The user list exists but the caller may not access it.
    /// </summary>
    ListAccessDenied,

    /// <summary>
    /// A reorder request's content ids do not match the user's lists exactly.
    /// </summary>
    ListReorderMismatch,

    /// <summary>
    /// A favorites-only filter was requested without an authenticated user.
    /// </summary>
    FavoritesRequireAuthentication,

    /// <summary>
    /// A mark-status filter was requested without an authenticated user.
    /// </summary>
    MarkStatusRequiresAuthentication
}
