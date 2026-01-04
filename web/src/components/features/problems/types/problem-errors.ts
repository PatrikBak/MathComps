import type { ApiCallError } from '@/types/api'

/**
 * Base error type for all problem-related operations.
 */
export type ProblemError = ProblemNotFoundError | ApiCallError

/**
 * Error thrown when a specific problem cannot be found by its slug.
 */
export type ProblemNotFoundError = {
  /** Discriminator */
  type: 'PROBLEM_NOT_FOUND'
  /** The problem slug that was not found */
  slug: string
  /** Human-readable error message for logging and user feedback */
  message: string
}

/**
 * Type guard to check if an error is a {@link ProblemNotFoundError}.
 *
 * @param error - The error to check.
 *
 * @returns True if the error is a {@link ProblemNotFoundError}, false otherwise.
 */
export function isProblemNotFoundError(error: unknown): error is ProblemNotFoundError {
  return (
    typeof error === 'object' &&
    error !== null &&
    'type' in error &&
    error.type === 'PROBLEM_NOT_FOUND'
  )
}
