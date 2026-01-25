/**
 * API error codes for structured error responses.
 */
export const API_ERROR_CODES = {
  // File upload errors
  INVALID_FILE_TYPE: 'INVALID_FILE_TYPE',
  FILE_TOO_LARGE: 'FILE_TOO_LARGE',
  UPLOAD_URL_FAILED: 'UPLOAD_URL_FAILED',

  // Validation errors
  INVALID_REQUEST: 'INVALID_REQUEST',
  VALIDATION_FAILED: 'VALIDATION_FAILED',

  // Auth errors
  UNAUTHORIZED: 'UNAUTHORIZED',

  // Generic errors
  SERVER_ERROR: 'SERVER_ERROR',
} as const

/** Type for API error codes */
type ApiErrorCode = (typeof API_ERROR_CODES)[keyof typeof API_ERROR_CODES]

/**
 * Structured error response from API routes.
 *
 * Contains an error code for client-side translation and optional
 * additional data for message interpolation (e.g., max file size).
 */
export type ApiErrorResponse = {
  /** The error code for client-side translation lookup */
  code: ApiErrorCode
  /** Optional additional data for message interpolation */
  [key: string]: unknown
}

/**
 * Type guard to check if an error response has a valid API error code.
 *
 * @param error - The error response to check
 *
 * @returns True if the error response has a valid API error code, false otherwise
 */
export function isApiErrorResponse(error: unknown): error is ApiErrorResponse {
  return (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    typeof (error as ApiErrorResponse).code === 'string' &&
    Object.values(API_ERROR_CODES).includes((error as ApiErrorResponse).code as ApiErrorCode)
  )
}
