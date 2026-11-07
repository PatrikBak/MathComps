import * as Sentry from '@sentry/nextjs'

/** The reports this page has filed, each by its fingerprint. */
const filedReports = new Set<string>()

/**
 * Files a report once per page load, so one visitor's run of failures is a single event while a
 * broken host shows as many visitors at once.
 *
 * @param fingerprint - What error tracking groups the report under, which also names it on this page.
 * @param report - The error the report carries.
 */
function reportOncePerPage(fingerprint: string[], report: Error): void {
  // The report's name on this page
  const key = fingerprint.join(' ')

  // A report this page has filed already
  if (filedReports.has(key)) return

  // The report counts as filed from here on
  filedReports.add(key)

  // The report, grouped by its fingerprint, since error tracking otherwise groups reports by the code
  // that made them
  Sentry.captureException(report, { fingerprint })
}

/**
 * Reports a request that got no answer at all: a CORS refusal, a DNS or TLS failure, a dropped
 * connection. No server of ours records such a failure, so the browser is its only witness. Each host
 * is reported once per page load, and an offline browser reports nothing, since its own network is
 * the cause.
 *
 * @param url - The address the request went to.
 * @param error - What the request failed with.
 */
export function reportUnansweredRequest(url: string, error: unknown): void {
  // An offline browser lost its own network, which says nothing about the host
  if (!navigator.onLine) return

  // The host alone, since a path can name a user's data
  const { host } = new URL(url, window.location.href)

  // One report per host, with the browser's own error as its cause
  reportOncePerPage(
    ['unanswered-request', host],
    new Error(`A request to ${host} got no answer`, { cause: error })
  )
}
