import * as Sentry from '@sentry/nextjs'

/**
 * Reports a server fault twice: a line in the server's log, which is all local dev sees, and an event
 * in error tracking.
 *
 * @param error - The fault.
 */
export function reportError(error: unknown) {
  // The server's log
  console.error(error)

  // Error tracking
  Sentry.captureException(error)
}
