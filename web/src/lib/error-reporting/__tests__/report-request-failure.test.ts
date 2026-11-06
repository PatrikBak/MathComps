import * as Sentry from '@sentry/nextjs'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { reportForeignRefusal, reportUnansweredRequest } from '../report-request-failure'

/**
 * Stand in for error tracking, so a test can read what reached it.
 */
vi.mock('@sentry/nextjs', () => ({
  captureException: vi.fn(),
}))

/**
 * Stand in for the configured API address.
 */
vi.mock('@/components/shared/utils/env-utils', () => ({
  getOptionalEnv: () => 'https://api.example.test',
}))

/**
 * Puts the test on a page of the site, with or without a network.
 *
 * @param isOnline - Whether the browser has a network.
 */
function openPage(isOnline: boolean) {
  // The page the requests leave from, which a relative address resolves against
  vi.stubGlobal('window', { location: { href: 'https://mathcomps.fun/sk/materialy' } })

  // The browser's own view of its network
  vi.stubGlobal('navigator', { onLine: isOnline })
}

/**
 * Reads the reports made so far.
 *
 * @returns The error of each report, in order.
 */
function reportedErrors(): Error[] {
  // Each report's error, the first argument of its call
  return vi.mocked(Sentry.captureException).mock.calls.map(([report]) => report as Error)
}

afterEach(() => {
  // Forget the reports made so far. The module's filed reports stay, as they would on one page, so
  // each test asks about hosts of its own
  vi.mocked(Sentry.captureException).mockClear()

  // Leave the page
  vi.unstubAllGlobals()
})

describe('reportUnansweredRequest', () => {
  it('reports each host once per page load', () => {
    // Two failures on the page's own host, a relative address among them, and one on another host
    const first = new TypeError('Failed to fetch')
    const second = new TypeError('Failed to fetch')
    const third = new TypeError('Failed to fetch')

    // A page with a network
    openPage(true)

    // Each failure reaches the reporter
    reportUnansweredRequest('/api/contact', first)
    reportUnansweredRequest('https://mathcomps.fun/api/files/upload-url', second)
    reportUnansweredRequest(
      'https://bucket.example.test/user-uploads/a.png?X-Amz-Signature=abc',
      third
    )

    // One report per host, so a visitor's bad connection files a single event
    expect(reportedErrors().map((report) => report.cause)).toEqual([first, third])
  })

  it("keeps an offline failure from using up the host's one report", () => {
    // The same host failing twice, first with no network and then with one
    const offlineFailure = new TypeError('Failed to fetch')
    const onlineFailure = new TypeError('Failed to fetch')

    // A page with no network
    openPage(false)

    // The host failing while offline
    reportUnansweredRequest('https://api.example.test/comments', offlineFailure)

    // The network back
    openPage(true)

    // The same host failing again
    reportUnansweredRequest('https://api.example.test/comments', onlineFailure)

    // Only the online one is reported, and the offline one did not use up the host's report
    expect(reportedErrors().map((report) => report.cause)).toEqual([onlineFailure])
  })
})

describe('reportForeignRefusal', () => {
  it('reports a foreign refusal once per host and status', () => {
    // The file store refusing twice with one status and once with another
    reportForeignRefusal('https://store.example.test/user-uploads/a.png?X-Amz-Signature=abc', 403)
    reportForeignRefusal('https://store.example.test/user-uploads/b.png?X-Amz-Signature=def', 403)
    reportForeignRefusal('https://store.example.test/user-uploads/c.png?X-Amz-Signature=ghi', 400)

    // One report per kind of refusal, so a visitor's repeated attempts file a single event each
    expect(reportedErrors()).toHaveLength(2)
  })

  it('leaves refusals from our own servers to them', () => {
    // A refusal from one of the site's own routes
    reportForeignRefusal('/api/files/upload-url', 500)

    // A refusal from the API
    reportForeignRefusal('https://api.example.test/comments', 500)

    // Neither reaches error tracking from here
    expect(reportedErrors()).toEqual([])
  })
})
