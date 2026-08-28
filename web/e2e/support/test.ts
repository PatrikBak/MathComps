import { expect, test as base } from '@playwright/test'

import { BACKEND_ORIGIN, stubReaderAndDiscussion } from './backend-routes'

/**
 * The runner every spec builds on, which holds each test to answering its own backend calls.
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
export const test = base.extend<{ hermeticBackend: void }>({
  hermeticBackend: [
    async ({ page }, use) => {
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

      // The reads every page makes about whoever is looking at it, which override the refusal above
      await stubReaderAndDiscussion(page)

      // The test itself
      await use()

      // A retry burst sends the same call four times, and naming it once is the whole of the finding
      const unanswered = [...new Set(escaped)]

      // Anything here would have been answered by a backend the runner does not have
      expect(unanswered, 'backend calls no stub answered').toEqual([])
    },
    { auto: true },
  ],
})

export { expect }
