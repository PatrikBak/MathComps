import type { ApiCallError } from '@/types/api'

/**
 * Base error type for all problem-related operations.
 */
export type ProblemError =
  | ProblemNotFoundError
  | ListNotFoundError
  | ListAccessDeniedError
  | ApiCallError

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
 * Error thrown when a list cannot be found by its contentId (404).
 */
export type ListNotFoundError = {
  /** Discriminator */
  type: 'LIST_NOT_FOUND'
  /** The contentId of the list that was not found */
  listContentId: string
  /** Human-readable error message for logging and user feedback */
  message: string
}

/**
 * Error thrown when the user does not have access to a private list (403).
 */
export type ListAccessDeniedError = {
  /** Discriminator */
  type: 'LIST_ACCESS_DENIED'
  /** The contentId of the list that access was denied for */
  listContentId: string
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

/**
 * Type guard to check if an error is a {@link ListNotFoundError}.
 *
 * @param error - The error to check.
 *
 * @returns True if the error is a {@link ListNotFoundError}, false otherwise.
 */
export function isListNotFoundError(error: unknown): error is ListNotFoundError {
  return (
    typeof error === 'object' &&
    error !== null &&
    'type' in error &&
    error.type === 'LIST_NOT_FOUND'
  )
}

/**
 * Type guard to check if an error is a {@link ListAccessDeniedError}.
 *
 * @param error - The error to check.
 *
 * @returns True if the error is a {@link ListAccessDeniedError}, false otherwise.
 */
export function isListAccessDeniedError(error: unknown): error is ListAccessDeniedError {
  return (
    typeof error === 'object' &&
    error !== null &&
    'type' in error &&
    error.type === 'LIST_ACCESS_DENIED'
  )
}
