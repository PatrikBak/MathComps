import type { Page } from '@playwright/test'
import { devices, expect, test as base } from '@playwright/test'

import { BACKEND_ORIGIN, serveStoredFiles, stubAmbientReads } from './backend-routes'

/** The phone a test's student holds beside the computer. */
const PHONE = devices['iPhone 15']

/**
 * Holds a page to answering its own backend calls, as {@link test} sets out.
 *
 * @param page - The page.
 *
 * @returns A function which fails the test, naming every call the page sent that nothing answered.
 */
async function holdToOwnAnswers(page: Page): Promise<() => void> {
  // Every call that neither the ambient stubs nor the test's own answered, in the order it was sent
  const escaped: string[] = []

  // Stand in for the whole backend, which is where a call nothing claimed ends up
  await page.route(`${BACKEND_ORIGIN}/**`, async (route) => {
    // The call as it went out
    const request = route.request()

    // Recorded before it is answered, so the check below names it whatever becomes of the call.
    // The origin is dropped, every one of them sharing it.
    escaped.push(`${request.method()} ${request.url().slice(BACKEND_ORIGIN.length)}`)

    // Answered the way CI answers it, which is not at all
    await route.abort('connectionrefused')
  })

  // The reads a page makes on its own account, which override the refusal above
  await stubAmbientReads(page)

  // The files the store holds, which an uploaded image on the page loads from
  await serveStoredFiles(page)

  // The check, run once the test is done
  return () => {
    // A retry burst sends the same call four times, and naming it once is the whole of the finding
    const unanswered = [...new Set(escaped)]

    // Anything here would have been answered by a backend the runner does not have
    expect(unanswered, 'backend calls no stub answered').toEqual([])
  }
}

/**
 * The runner every spec builds on, which holds each test to answering its own backend calls, on its phone's page
 * as on its own.
 *
 * CI has no API behind the app, so a test leaning on one there fails for reasons that have nothing to
 * do with what it is about. The reverse is worse and is what this exists for: a call nobody stood in
 * for is answered by whatever the author happened to have running, so the test passes on their machine
 * and proves nothing anywhere else. Two layers, registered in this order because a later route is the
 * one Playwright tries first, so each overrides the one before it and a spec's own stub beats both:
 * everything refused, then the handful of ambient reads no spec is about.
 *
 * A test that reaches the first layer fails naming the call, which is what keeps this true as the app
 * grows endpoints. The one hole it cannot see through is `route.continue()`, which goes to the network
 * rather than to the routes underneath it. Nothing here may use it.
 */
export const test = base.extend<{ hermeticBackend: void; phone: Page }>({
  hermeticBackend: [
    async ({ page }, runTest) => {
      // The page held to its own answers
      const expectAllAnswered = await holdToOwnAnswers(page)

      // The test itself
      await runTest()

      // With nothing left unanswered
      expectAllAnswered()
    },
    { auto: true },
  ],

  // A page on the student's phone, in a browser of its own signed in to nothing, under the runner's own user agent,
  // which Clerk's sign-in handshake needs
  phone: async ({ browser, baseURL, userAgent }, runTest) => {
    // The phone's browser
    const context = await browser.newContext({ ...PHONE, baseURL, userAgent })

    // Its page
    const page = await context.newPage()

    // Held to its own answers
    const expectAllAnswered = await holdToOwnAnswers(page)

    // The test itself
    await runTest(page)

    // With nothing left unanswered
    expectAllAnswered()

    // The browser put away
    await context.close()
  },
})

/**
 * How long the app gets to settle before a wait on it is called a failure. Held under a test's own
 * timeout, so the wait is the one that fires.
 */
export const SETTLE_TIMEOUT_MS = 15_000

export { expect }
