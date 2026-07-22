import type { AppErrorCode } from '@/lib/api/api-error-codes'
import type { ApiResult } from '@/types/api'

/**
 * The details to build a {@link BackendApiError}.
 */
type BackendApiErrorInit = {
  /** Human-readable message for the base {@link Error}. */
  message?: string
  /** The machine-readable failure code, or undefined when the failure carried none. */
  errorCode?: AppErrorCode
  /** The HTTP status the server returned, or undefined for a client-side failure. */
  statusCode?: number
  /** Interpolation values for a coded message with placeholders (e.g. `FILE_TOO_LARGE`'s max). */
  data?: Record<string, string | number>
}

/**
 * A failed API call raised as a throwable, carrying the machine-readable failure code and the HTTP
 * status. The single client error class for both C# backend calls and the app's own Next.js routes.
 */
export class BackendApiError extends Error {
  /** The failure code, or undefined when the failure carried none. */
  readonly errorCode: AppErrorCode | undefined

  /** The HTTP status the server returned, or undefined for a client-side failure. */
  readonly statusCode: number | undefined

  /** Interpolation values for the coded message, or undefined when it needs none. */
  readonly data: Record<string, string | number> | undefined

  /**
   * Builds the error from a failed call's details.
   *
   * @param init - The failure's message, code, status, and any interpolation values.
   */
  constructor(init: BackendApiErrorInit) {
    // Keep a human message on the base Error, falling back to the code
    super(init.message ?? init.errorCode ?? 'API request failed')

    // Carry the code, status, and interpolation values through the throw
    this.errorCode = init.errorCode
    this.statusCode = init.statusCode
    this.data = init.data
  }
}

/**
 * Reads the failure code off a caught error.
 *
 * @param error - The error a call threw.
 *
 * @returns The code a {@link BackendApiError} carries, or undefined for any other thrown value.
 */
export function errorCodeOf(error: unknown): AppErrorCode | undefined {
  // Only a BackendApiError carries a code; anything else is an opaque fault
  return error instanceof BackendApiError ? error.errorCode : undefined
}

/**
 * Reads the interpolation values off a caught error.
 *
 * @param error - The error a call threw.
 *
 * @returns The values a {@link BackendApiError} carries, or undefined for any other thrown value.
 */
export function errorDataOf(error: unknown): Record<string, string | number> | undefined {
  // Only a BackendApiError carries interpolation values
  return error instanceof BackendApiError ? error.data : undefined
}

/**
 * Unwraps a settled API result to its data, throwing a {@link BackendApiError} on failure.
 *
 * @param result - The settled result of an API call.
 *
 * @returns The call's data.
 */
export function unwrap<T>(result: ApiResult<T>): T {
  // A failed call throws, carrying the failure code
  if (!result.success) {
    throw new BackendApiError(result.error)
  }

  // The successful call's data
  return result.data
}
