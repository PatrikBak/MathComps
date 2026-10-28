import * as Sentry from '@sentry/nextjs'

import { SENTRY_OPTIONS } from '@/lib/error-reporting/sentry-options'

/**
 * Starts error reporting on the server, once per instance and before it serves a request.
 */
export function register() {
  // Server faults reach Better Stack from here on
  Sentry.init(SENTRY_OPTIONS)
}

/**
 * Reports an error Next.js caught on the server: in a page or layout render, a server action, a route
 * handler or the proxy.
 * Next.js keeps its own control flow out of this hook, so a `notFound()` or a redirect never files.
 */
export const onRequestError = Sentry.captureRequestError
