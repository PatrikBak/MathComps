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
    MarkStatusRequiresAuthentication,

    /// <summary>
    /// The referenced defense session does not exist (or belongs to another user).
    /// </summary>
    DefenseSessionNotFound,

    /// <summary>
    /// A defense message or problem text exceeded its length cap.
    /// </summary>
    DefenseMessageTooLong,

    /// <summary>
    /// A defense message was blank.
    /// </summary>
    DefenseMessageEmpty,

    /// <summary>
    /// The defense conversation has reached its turn limit.
    /// </summary>
    DefenseTurnLimit,

    /// <summary>
    /// The user has reached their daily defense spend ceiling.
    /// </summary>
    DefenseSpendLimit,

    /// <summary>
    /// A rewind's cut point is out of range or not an examiner turn.
    /// </summary>
    DefenseRewindTarget,

    /// <summary>
    /// The request is authenticated but its caller could not be resolved to a user.
    /// </summary>
    UserNotResolved
}
