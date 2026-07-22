import type { AppErrorCode } from '@/lib/api/api-error-codes'

/**
 * A failed API call. Carries a human-readable message always; a failure that came back over the wire
 * also carries the HTTP status and the machine-readable code, while a client-side failure (not signed
 * in, a thrown fetch or parse error) carries neither.
 */
type ApiCallError = {
  /** Human-readable error message describing what went wrong. */
  message: string
  /** The HTTP status the server returned, or undefined for a client-side failure. */
  statusCode?: number
  /** The machine-readable failure code, or undefined when the response carried none. */
  errorCode?: AppErrorCode
}

/**
 * A successful API call.
 */
type ApiSuccess<T> = {
  /** The discriminator. */
  success: true
  /** The data returned by the API. */
  data: T
}

/**
 * A failed API call.
 */
type ApiFailure = {
  /** The discriminator. */
  success: false
  /** The error the call returned. */
  error: ApiCallError
}

/**
 * Result of an API call: a discriminated union of success with data or failure with an
 * {@link ApiCallError}.
 */
export type ApiResult<T> = ApiSuccess<T> | ApiFailure
