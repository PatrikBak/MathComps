import { type ApiCallError, type ApiResult, isNetworkError } from '@/types/api'
import type { BackendErrorCode } from '@/types/backend-error-codes'

/**
 * A failed backend API call raised as a throwable, carrying the backend's machine-readable failure code.
 */
export class BackendApiError extends Error {
  /** The backend's failure code, or undefined when the failure carried none. */
  readonly errorCode: BackendErrorCode | undefined

  /**
   * Builds the error from a failed API result's error.
   *
   * @param error - The error a failed API call returned.
   */
  constructor(error: ApiCallError) {
    // Keep the human message on the base Error
    super(error.message)

    // Only a network failure carries the backend's machine-readable code
    this.errorCode = isNetworkError(error) ? error.errorCode : undefined
  }
}

/**
 * Reads the backend failure code off a caught error.
 *
 * @param error - The error a call threw.
 *
 * @returns The code a {@link BackendApiError} carries, or undefined for any other thrown value.
 */
export function errorCodeOf(error: unknown): BackendErrorCode | undefined {
  // Only a BackendApiError carries a code; anything else is an opaque fault
  return error instanceof BackendApiError ? error.errorCode : undefined
}

/**
 * Unwraps a settled API result to its data, throwing a {@link BackendApiError} on failure.
 *
 * @param result - The settled result of an API call.
 *
 * @returns The call's data.
 */
export function unwrap<T>(result: ApiResult<T>): T {
  // A failed call throws, carrying the backend's failure code
  if (!result.success) {
    throw new BackendApiError(result.error)
  }

  // The successful call's data
  return result.data
}
