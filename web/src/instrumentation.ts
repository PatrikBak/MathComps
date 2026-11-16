import * as Sentry from '@sentry/nextjs'
import type { Instrumentation } from 'next'
import { isNextRouterError } from 'next/dist/client/components/is-next-router-error'

import { type CallerKind, callerKindOf } from '@/lib/error-reporting/caller-kind'
import { SENTRY_OPTIONS } from '@/lib/error-reporting/sentry-options'

/**
 * Starts error reporting on the server, once per instance and before it serves a request.
 */
export function register() {
  // Server faults reach Better Stack from here on, tagged background unless onRequestError names the sender
  Sentry.init({
    ...SENTRY_OPTIONS,
    initialScope: { tags: { caller: 'background' satisfies CallerKind } },
  })
}

/**
 * Reports an error Next.js caught on the server: in a page or layout render, a server action, a route
 * handler or the proxy. A `notFound()` still arrives here when Next.js cannot render the 404, as for
 * an address that names no language (`/llms.txt`), which then answers 500.
 */
export const onRequestError: Instrumentation.onRequestError = (error, request, context) => {
  // An answer the page asked Next.js for, such as a 404 or a redirect, is no fault of the site's
  if (isNextRouterError(error)) {
    return
  }

  // The sender's User-Agent, which arrives as a list when the header repeats
  const userAgent = request.headers['user-agent']

  // Report anything else as a fault, tagged with who sent the request
  Sentry.withScope((scope) => {
    // The sender, read off the agent
    scope.setTag('caller', callerKindOf(typeof userAgent === 'string' ? userAgent : '', false))

    // The fault, with the request it happened in
    Sentry.captureRequestError(error, request, context)
  })
}
