import { auth } from '@clerk/nextjs/server'
import * as Sentry from '@sentry/nextjs'

/**
 * Reports a server fault twice: a line in the server's log, which is all local dev sees, and an event
 * in error tracking. The event names a signed-in caller by Clerk id, the id the API's events carry too.
 *
 * @param error - The fault.
 */
export async function reportError(error: unknown) {
  // The server's log
  console.error(error)

  // The caller's Clerk id, null for a visitor
  const { userId } = await auth()

  // Error tracking, naming the caller on this one event
  Sentry.captureException(error, userId ? { user: { id: userId } } : undefined)
}
