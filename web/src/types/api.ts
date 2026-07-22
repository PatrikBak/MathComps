import type { BackendErrorCode } from '@/types/backend-error-codes'

/**
 * Base error structure for all API-related operations.
 */
type ApiErrorBase = {
  /** Human-readable error message describing what went wrong */
  message: string
}

/**
 * Represents an error where the user is not authenticated or the token is invalid.
 */
type UnauthenticatedError = ApiErrorBase & {
  /** The discriminator */
  type: 'unauthenticated'
}

/**
 * Represents a network or server error (non-2xx response).
 */
type NetworkError = ApiErrorBase & {
  /** The discriminator */
  type: 'network'
  /** The HTTP status code returned by the server, if available */
  statusCode?: number
  /** The backend's machine-readable failure code, or undefined when the response carried none */
  errorCode: BackendErrorCode | undefined
}

/**
 * Represents an unexpected error.
 */
type UnknownError = ApiErrorBase & {
  /** The discriminator */
  type: 'unknown'
}

/**
 * Combined type for all standard API errors.
 */
export type ApiCallError = UnauthenticatedError | NetworkError | UnknownError

/**
 * Represents a successful API call.
 */
type ApiSuccess<T> = {
  /** The discriminator */
  success: true
  /** The data returned by the API */
  data: T
}

/**
 * Represents a failed API call.
 */
type ApiFailure<E = ApiCallError> = {
  /** The discriminator */
  success: false
  /** The error returned by the API */
  error: E
}

/**
 * Result type for API calls - discriminated union representing success or error states.
 */
export type ApiResult<T, E = ApiCallError> = ApiSuccess<T> | ApiFailure<E>

/**
 * Type guard for {@link NetworkError}.
 *
 * @param error - The error to check.
 *
 * @returns True if the error is a {@link NetworkError}, false otherwise.
 */
export function isNetworkError(error: unknown): error is NetworkError {
  return typeof error === 'object' && error !== null && 'type' in error && error.type === 'network'
}
