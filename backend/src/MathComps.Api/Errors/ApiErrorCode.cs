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
    /// The handout environment a defense was started against has no content on the site, in the language asked
    /// for. Covers every defendable kind, not just problems — a theorem or exercise resolves the same way.
    /// </summary>
    DefenseEnvironmentNotFound,

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
    /// A report names a turn the conversation doesn't hold, or one the student authored.
    /// </summary>
    DefenseReportTarget,

    /// <summary>
    /// Feedback the contract cannot take: a value outside the ones it names, or a report or answer that says
    /// nothing.
    /// </summary>
    DefenseFeedbackValue,

    /// <summary>
    /// A feedback comment is over its length cap.
    /// </summary>
    DefenseFeedbackCommentTooLong,

    /// <summary>
    /// A review note the contract cannot take: no text at all, more text than a note may carry, or a category
    /// outside the ones it names.
    /// </summary>
    AdminNoteValue,

    /// <summary>
    /// A review note stands against a reply the conversation doesn't hold.
    /// </summary>
    AdminNoteTarget,

    /// <summary>
    /// No review note exists under the id.
    /// </summary>
    AdminNoteNotFound,

    /// <summary>
    /// The caller is not the reviewer who wrote the note they tried to revise or drop.
    /// </summary>
    NotAdminNoteAuthor,

    /// <summary>
    /// A reviewer's reading is moved back to a turn the conversation doesn't hold.
    /// </summary>
    AdminReviewTarget,

    /// <summary>
    /// The request body could not be read into what the route expects: broken JSON, a field of the wrong
    /// type, a value no member of an enumeration names, or no body at all.
    /// </summary>
    MalformedRequest,

    /// <summary>
    /// The request is authenticated but its caller could not be resolved to a user.
    /// </summary>
    UserNotResolved,

    /// <summary>
    /// The requested username already answers for somebody else.
    /// </summary>
    UsernameTaken,

    /// <summary>
    /// The caller already has a username, which cannot be exchanged for another.
    /// </summary>
    UsernameAlreadySet,

    /// <summary>
    /// The requested username breaks the rules a name has to keep: its length, or the characters in it.
    /// </summary>
    UsernameRejected,

    /// <summary>
    /// A profile field is outside what it is allowed to say, such as a country code that is not one.
    /// </summary>
    ProfileValueInvalid,

    /// <summary>
    /// The request reached an authenticated endpoint without a valid bearer token (missing, malformed,
    /// or expired).
    /// </summary>
    Unauthenticated,

    /// <summary>
    /// The caller is authenticated but lacks the role or policy the endpoint requires.
    /// </summary>
    Forbidden,

    /// <summary>
    /// The caller exceeded a rate limit and should retry later.
    /// </summary>
    RateLimited
}
