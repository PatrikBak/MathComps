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
  'DefenseMessageTooLong',
  'DefenseMessageEmpty',
  'DefenseTurnLimit',
  'DefenseSpendLimit',
  'DefenseRewindTarget',
  'UserNotResolved',
] as const

/** One of the backend's business-failure codes. */
export type BackendErrorCode = (typeof BACKEND_ERROR_CODES)[number]
