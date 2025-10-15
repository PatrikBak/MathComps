/**
 * Error types for problem-related operations in the MathComps application.
 * These provide type-safe error handling instead of string-based errors.
 *
 * All errors follow a discriminated union pattern using the `type` field,
 * allowing for exhaustive type checking and proper error handling flows.
 */

// #region Error Types

/**
 * Base error type for all problem-related operations.
 *
 * This discriminated union allows TypeScript to narrow error types safely
 * and ensures all error cases are handled explicitly in error handling code.
 */
export type ProblemError = ProblemNotFoundError | NetworkError | ServerError | ValidationError

/**
 * Error thrown when a specific problem cannot be found by its slug.
 *
 * **When this occurs:**
 * - User navigates to a problem with id=nonexistent-slug`
 * - API returns 404 status code
 * - Problem exists but was deleted or is not yet published
 * - Slug is malformed or doesn't match any problem in the database
 *
 * **Handling strategy:**
 * - Do NOT retry (permanent failure)
 * - Show user-friendly error message
 * - Redirect to the problems page
 */
export type ProblemNotFoundError = {
  /** Discriminator for type narrowing */
  type: 'PROBLEM_NOT_FOUND'
  /** The problem slug that was not found */
  slug: string
  /** Human-readable error message for logging and user feedback */
  message: string
}

/**
 * Error thrown when network communication with the API fails.
 *
 * **When this occurs:**
 * - Backend API is down or unreachable
 * - DNS resolution fails
 * - Connection timeout (slow network, server overload)
 * - CORS policy violation
 * - Request aborted by client (e.g., user navigated away)
 * - API returns 4xx client errors (except 404, which is ProblemNotFoundError)
 */
type NetworkError = {
  /** Discriminator for type narrowing */
  type: 'NETWORK_ERROR'
  /** Human-readable error message describing what went wrong */
  message: string
  /** HTTP status code if available (e.g., 400, 403, 408, 429, 503) */
  status?: number
}

/**
 * Error thrown when the backend server encounters an internal error.
 *
 * **When this occurs:**
 * - API returns 5xx status codes (500, 502, 503, 504)
 * - Database connection fails on the server
 * - Unhandled exception in API endpoint
 * - Server returns non-JSON response (HTML error page, plain text)
 * - Response payload is malformed or missing expected structure
 */
type ServerError = {
  /** Discriminator for type narrowing */
  type: 'SERVER_ERROR'
  /** Human-readable error message (safe to log, not always safe to show user) */
  message: string
  /** HTTP status code if available (e.g., 500, 502, 503, 504) */
  status?: number
}

/**
 * Error thrown when request parameters are invalid or malformed.
 *
 * **When this occurs:**
 * - Filter parameters are out of valid range
 * - Search query contains invalid characters
 * - Pagination parameters are negative or exceed limits
 * - Required fields are missing from the request
 * - Data type mismatches (string where number expected)
 */
type ValidationError = {
  /** Discriminator for type narrowing */
  type: 'VALIDATION_ERROR'
  /** Human-readable error message explaining the validation failure */
  message: string
  /** Optional field name that failed validation (for form-based errors) */
  field?: string
}

// #region Type Guards

/**
 * Type guard to check if an error is a ProblemNotFoundError.
 *
 * Use this in retry logic to avoid retrying permanent failures and in error handling
 * to provide specific user feedback for missing problems.
 *
 * @param error - Unknown error object to check
 * @returns True if error is a ProblemNotFoundError, false otherwise
 */
export function isProblemNotFoundError(error: unknown): error is ProblemNotFoundError {
  return (
    typeof error === 'object' &&
    error !== null &&
    'type' in error &&
    error.type === 'PROBLEM_NOT_FOUND'
  )
}

/**
 * Type guard to check if an error is a NetworkError.
 *
 * Use this to implement retry logic with exponential backoff for transient network issues.
 *
 * @param error - Unknown error object to check
 * @returns True if error is a NetworkError, false otherwise
 */
export function isNetworkError(error: unknown): error is NetworkError {
  return (
    typeof error === 'object' && error !== null && 'type' in error && error.type === 'NETWORK_ERROR'
  )
}

/**
 * Type guard to check if an error is a ServerError.
 *
 * Use this to distinguish server-side failures from client-side issues and to
 * log errors appropriately for monitoring and debugging.
 *
 * @param error - Unknown error object to check
 * @returns True if error is a ServerError, false otherwise
 */
export function isServerError(error: unknown): error is ServerError {
  return (
    typeof error === 'object' && error !== null && 'type' in error && error.type === 'SERVER_ERROR'
  )
}

/**
 * Type guard to check if an error is a ValidationError.
 *
 * Use this to provide field-specific feedback in forms and to avoid retrying
 * requests that will always fail due to invalid input.
 *
 * @param error - Unknown error object to check
 * @returns True if error is a ValidationError, false otherwise
 */
export function isValidationError(error: unknown): error is ValidationError {
  return (
    typeof error === 'object' &&
    error !== null &&
    'type' in error &&
    error.type === 'VALIDATION_ERROR'
  )
}
