/**
 * The backend's machine-readable business-failure codes, as they appear in a problem response's
 * `errorCode` field. The names match the C# `ApiErrorCode` enum, guarded by a backend parity test.
 */
export const BACKEND_ERROR_CODES = [
  'CommentNotFound',
  'NotCommentAuthor',
  'CannotLikeOwnComment',
  'CommentTargetNotFound',
  'ProblemNotFound',
  'ListNotFound',
  'ListAccessDenied',
  'ListReorderMismatch',
  'FavoritesRequireAuthentication',
  'MarkStatusRequiresAuthentication',
  'DefenseSessionNotFound',
  'DefenseEnvironmentNotFound',
  'DefenseMessageTooLong',
  'DefenseMessageEmpty',
  'DefenseTurnLimit',
  'DefenseSpendLimit',
  'DefenseRewindTarget',
  'DefenseReportTarget',
  'DefenseFeedbackValue',
  'DefenseFeedbackCommentTooLong',
  'AdminNoteValue',
  'AdminNoteTarget',
  'AdminNoteNotFound',
  'NotAdminNoteAuthor',
  'AdminReviewTarget',
  'MalformedRequest',
  'UserNotResolved',
  'Unauthenticated',
  'Forbidden',
  'RateLimited',
] as const

/** One of the backend's business-failure codes. */
export type BackendErrorCode = (typeof BACKEND_ERROR_CODES)[number]
