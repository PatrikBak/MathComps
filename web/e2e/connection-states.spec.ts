import type { Page } from '@playwright/test'
import { expect, test } from '@playwright/test'

import { ROUTES } from '@/i18n/i18n'

import messages from '../messages/en.json'

/**
 * The problems page in English, which is the canonical locale and so carries no route translation.
 * The locale is fixed here because it picks the messages the assertions below match on.
 */
const PROBLEMS_PATH = `/en${ROUTES.PROBLEMS}`

/**
 * How long the page needs to exhaust its retry burst: four attempts spread over roughly 3.5s of
 * backoff, plus room for the requests themselves. A generous bound rather than an exact one, so
 * raising the retry count is meant to bring you here rather than to quietly stretch the wait.
 */
const SETTLE_TIMEOUT_MS = 15_000

/**
 * The copy the assertions match on, taken from the app's own English messages: what each of them
 * means is that a particular message is on screen, not that a particular sentence is.
 */
const { problems: problemsCopy, ui: uiCopy } = messages

/**
 * Where the backend listens, read from the same variable the app builds its request URLs from. A
 * hardcoded origin that drifted would stop intercepting silently, and the page would then fail for
 * reasons that look nothing like a stale constant.
 */
const BACKEND_ORIGIN = (() => {
  // Whatever the environment holds under the name the app itself reads
  const apiUrl = process.env.NEXT_PUBLIC_API_URL

  // The app cannot make a single call without it, so there would be nothing to intercept
  if (apiUrl === undefined || apiUrl.trim() === '') {
    throw new Error('Missing NEXT_PUBLIC_API_URL. It belongs in web/.env.')
  }

  // Trim the trailing slash so the route globs below have exactly one separator
  return apiUrl.replace(/\/$/, '')
})()

/**
 * Counts the calls the app makes to the backend and answers every one of them as unreachable.
 *
 * Standing in for the API here rather than stopping the real one keeps these tests deterministic,
 * and lets a single test watch traffic stop and start. Clerk's own traffic is left alone, since the
 * page never gets as far as querying without it.
 *
 * @param page - The page to intercept requests on.
 *
 * @returns How many backend calls have been attempted so far.
 */
async function failEveryBackendCall(page: Page): Promise<() => number> {
  // Every attempt counts, including the ones React Query makes on its own
  let attempts = 0

  // Stand in for the whole backend
  await page.route(`${BACKEND_ORIGIN}/**`, async (route) => {
    // The call was made, whatever becomes of it
    attempts++

    // An aborted connection is what a stopped API looks like from the browser: no response, no status
    await route.abort('connectionrefused')
  })

  // Hand back a reader rather than the counter itself, so the caller always sees the live value
  return () => attempts
}

/**
 * Counts the calls the app makes to the backend and has the server refuse every one of them.
 *
 * A refusal is the opposite of an outage: the server answered, so repeating the request cannot help.
 *
 * @param page - The page to intercept requests on.
 * @param status - The client-error status to answer with.
 *
 * @returns How many backend calls have been attempted so far.
 */
async function refuseEveryBackendCall(page: Page, status: number): Promise<() => number> {
  // Every attempt counts, including the ones React Query makes on its own
  let attempts = 0

  // Stand in for the whole backend
  await page.route(`${BACKEND_ORIGIN}/**`, async (route) => {
    // The call was made, whatever becomes of it
    attempts++

    // A bodyless client error is what a rate limiter or an authorization check looks like here
    await route.fulfill({ status })
  })

  // Hand back a reader rather than the counter itself, so the caller always sees the live value
  return () => attempts
}

/**
 * Whether the local API is up, for the tests that need one call to genuinely succeed.
 *
 * @returns Whether the backend answered at all, whatever it answered with.
 */
async function isBackendReachable(): Promise<boolean> {
  // Reaching the origin at all is the whole question, so any thrown result means no
  try {
    // Any HTTP answer proves something is listening; the status itself is beside the point
    await fetch(BACKEND_ORIGIN)

    // Something answered
    return true
  } catch {
    // Only a refused connection lands here
    return false
  }
}

/**
 * Simulates leaving the tab and coming back, which is what React Query watches to revive a query
 * that gave up.
 *
 * @param page - The page to switch away from and back to.
 */
async function returnToTab(page: Page): Promise<void> {
  // React Query reads document.visibilityState and listens for the event on window, so overriding
  // the one and dispatching the other is the whole of a tab switch as far as it is concerned
  await page.evaluate(() => {
    // A function which puts the document into a visibility state and announces it
    const setVisibility = (state: string) => {
      Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => state })
      window.dispatchEvent(new Event('visibilitychange'))
    }

    // Leave the tab
    setVisibility('hidden')

    // Come back to it
    setVisibility('visible')
  })
}

/**
 * Cuts the browser's own offline signal, which is what tells React Query to hold requests back.
 *
 * Taking the network itself away would also take the page's own server with it, and a filter change
 * navigates: a navigation that cannot be fetched leaves the browser on its error page with no app
 * left to assert against.
 *
 * @param page - The page to take offline.
 */
async function goOffline(page: Page): Promise<void> {
  // Both React Query and the app-wide banner read the property and listen for the event on window
  await page.evaluate(() => {
    Object.defineProperty(navigator, 'onLine', { configurable: true, get: () => false })
    window.dispatchEvent(new Event('offline'))
  })
}

test.describe('problems page with the API down', () => {
  test('stops claiming to retry once its attempts are spent', async ({ page }) => {
    // Every call fails from the moment the page boots
    await failEveryBackendCall(page)

    // Load the page and let the retry burst run itself out
    await page.goto(PROBLEMS_PATH)

    // The settled failure names the cause
    await expect(page.getByText(problemsCopy.connectionFailedHint)).toBeVisible({
      timeout: SETTLE_TIMEOUT_MS,
    })

    // And offers the only thing that will change it
    await expect(page.getByRole('button', { name: uiCopy.actions.retry })).toBeVisible()

    // The heart of the fix: nothing is in flight, so nothing may claim to be trying
    await expect(page.getByText(problemsCopy.tryingToConnect)).toBeHidden()
  })

  test('shows the spinner only while a request is genuinely in flight', async ({ page }) => {
    // Fail every call, and watch how many are attempted
    const attempts = await failEveryBackendCall(page)

    // Load the page
    await page.goto(PROBLEMS_PATH)

    // Wait for it to give up
    await expect(page.getByRole('button', { name: uiCopy.actions.retry })).toBeVisible({
      timeout: SETTLE_TIMEOUT_MS,
    })

    // Note where the traffic stood once the page gave up
    const attemptsBeforeRetry = attempts()

    // Ask for another attempt
    await page.getByRole('button', { name: uiCopy.actions.retry }).click()

    // Now the claim is true, so the spinner and its notice come back
    await expect(page.getByText(problemsCopy.tryingToConnect)).toBeVisible()

    // And a real request went out behind it
    expect(attempts()).toBeGreaterThan(attemptsBeforeRetry)
  })

  test('retries by itself when the reader returns to the tab', async ({ page }) => {
    // Fail every call, and watch how many are attempted
    const attempts = await failEveryBackendCall(page)

    // Load the page
    await page.goto(PROBLEMS_PATH)

    // Wait for it to give up
    await expect(page.getByRole('button', { name: uiCopy.actions.retry })).toBeVisible({
      timeout: SETTLE_TIMEOUT_MS,
    })

    // Where the traffic stood once it settled
    const attemptsWhileIdle = attempts()

    // Sit on the dead page for a while
    await page.waitForTimeout(3000)

    // Nothing has been tried in the meantime: no timer polls in the background
    expect(attempts()).toBe(attemptsWhileIdle)

    // Coming back to the tab is what revives it, with nothing for the reader to click
    await returnToTab(page)

    // So a request goes out on its own
    await expect.poll(attempts).toBeGreaterThan(attemptsWhileIdle)
  })

  test('blames the network rather than the server once the browser goes offline', async ({
    page,
    context,
  }) => {
    // Fail every call so the page settles into a failure it can be nudged out of
    await failEveryBackendCall(page)

    // Load the page
    await page.goto(PROBLEMS_PATH)

    // Wait for it to give up
    await expect(page.getByRole('button', { name: uiCopy.actions.retry })).toBeVisible({
      timeout: SETTLE_TIMEOUT_MS,
    })

    // Drop the connection, which React Query notices through the browser's own offline event
    await context.setOffline(true)

    // The next attempt is held back rather than sent
    await page.getByRole('button', { name: uiCopy.actions.retry }).click()

    // So the page names the reader's connection instead of the server. The heading is what tells
    // this apart from the app-wide offline banner, which says the same thing.
    await expect(page.getByRole('heading', { name: problemsCopy.offlineTitle })).toBeVisible()

    // And it promises the recovery it can actually deliver, since a paused fetch does resume
    await expect(page.getByText(problemsCopy.offlineHint)).toBeVisible()

    // Restore the connection so the browser is not left offline for the next test
    await context.setOffline(false)
  })
})

test.describe('problems page with only some calls failing', () => {
  // Unlike the tests above, these need the real API: each turns on one call failing while another
  // succeeds, and only a live backend can supply the half that works.
  test.beforeAll(async () => {
    // Skipping beats failing with an assertion that says nothing about the missing backend
    test.skip(!(await isBackendReachable()), 'needs the local API running')
  })

  test('explains a problem that failed to load instead of sitting on skeletons', async ({
    page,
  }) => {
    // Fail only the single-problem fetch, which is the one GET the page makes
    await page.route(`${BACKEND_ORIGIN}/**`, async (route) => {
      // The problem itself never arrives
      if (route.request().method() === 'GET') {
        await route.abort('connectionrefused')
        return
      }

      // Everything else, the filter options included, is served for real
      await route.continue()
    })

    // Open the page on a problem, whose slug never matters because the call never lands
    await page.goto(`${PROBLEMS_PATH}?id=any-problem-slug`)

    // Without the problem there is nothing to render, so the page has to say why and offer a way out
    await expect(page.getByRole('button', { name: uiCopy.actions.retry })).toBeVisible({
      timeout: SETTLE_TIMEOUT_MS,
    })
  })

  test('sends a reader whose problem does not exist back to the list', async ({ page }) => {
    // Stand in for the lookup alone
    await page.route(`${BACKEND_ORIGIN}/**`, async (route) => {
      // A lookup that matches nothing answers successfully with no items, which the service reads
      // as a missing problem rather than as a failure to reach anything
      if (route.request().method() === 'GET') {
        await route.fulfill({ status: 200, contentType: 'application/json', body: '{}' })
        return
      }

      // Everything else is served for real
      await route.continue()
    })

    // Ask for a problem that cannot be found
    await page.goto(`${PROBLEMS_PATH}?id=no-such-problem`)

    // A missing problem is not a connection to wait on, so the reader is returned to the full list
    await expect(page).toHaveURL(PROBLEMS_PATH, { timeout: SETTLE_TIMEOUT_MS })

    // And is offered nothing to retry, because another attempt would find it just as absent
    await expect(page.getByRole('button', { name: uiCopy.actions.retry })).toBeHidden()
  })

  test('reports a failed load-more once, under the rows it could not extend', async ({ page }) => {
    // The backend stays up until the test says otherwise
    let breakEverything = false

    // Stand in for it either way, so the switch takes effect mid-test
    await page.route(`${BACKEND_ORIGIN}/**`, async (route) => {
      // Once broken, nothing lands
      if (breakEverything) {
        await route.abort('connectionrefused')
        return
      }

      // Until then, everything is served for real
      await route.continue()
    })

    // Load the page
    await page.goto(PROBLEMS_PATH)

    // Wait for results, since the point is what happens to a list that already has rows
    const scroller = page.getByTestId('virtuoso-scroller')
    await scroller.waitFor({ timeout: SETTLE_TIMEOUT_MS })

    // Now take the backend away
    breakEverything = true

    // Scroll to the end, which is what asks for the next page
    await scroller.evaluate((element) => {
      element.scrollTop = element.scrollHeight
    })

    // The rows survive, and the failure is reported where the missing ones would have gone
    await expect(page.getByText(problemsCopy.errors.loadMoreFailed)).toBeVisible({
      timeout: SETTLE_TIMEOUT_MS,
    })

    // The way to act on it floats above the page instead, where scrolling cannot carry it off, and
    // it names the cause rather than repeating what the list just said
    await expect(page.getByText(problemsCopy.connectionFailed)).toBeVisible()

    // And it exists exactly once: two of them is one affordance too many, and the one riding the
    // list is the one a reader ends up chasing
    await expect(page.getByRole('button', { name: uiCopy.actions.retry })).toHaveCount(1)
  })

  test('holds the end of the list still while the failed load-more retries', async ({ page }) => {
    // The backend stays up until the test says otherwise
    let breakEverything = false

    // Stand in for it either way, so the switch takes effect mid-test
    await page.route(`${BACKEND_ORIGIN}/**`, async (route) => {
      // Once broken, nothing lands
      if (breakEverything) {
        await route.abort('connectionrefused')
        return
      }

      // Until then, everything is served for real
      await route.continue()
    })

    // Load the page
    await page.goto(PROBLEMS_PATH)

    // Wait for results, since this is about a list that already has rows
    const scroller = page.getByTestId('virtuoso-scroller')
    await scroller.waitFor({ timeout: SETTLE_TIMEOUT_MS })

    // Now take the backend away
    breakEverything = true

    // Scroll to the end so the next page is asked for, and fails
    await scroller.evaluate((element) => {
      element.scrollTop = element.scrollHeight
    })

    // Park on the report of that failure
    await expect(page.getByText(problemsCopy.errors.loadMoreFailed)).toBeVisible({
      timeout: SETTLE_TIMEOUT_MS,
    })

    // The scroll range the reader is working with once the report is on screen
    const rangeWithReport = await scroller.evaluate((element) => element.scrollHeight)

    // Coming back to the tab retries, which swaps the report for the spinner and back again
    await returnToTab(page)

    // Watch the range across the whole retry, since a wobble lasts only as long as the request
    let smallestRange = rangeWithReport
    for (let sample = 0; sample < 30; sample++) {
      const range = await scroller.evaluate((element) => element.scrollHeight)
      smallestRange = Math.min(smallestRange, range)
      await page.waitForTimeout(200)
    }

    // Every state the end of the list can be in is one line tall, so a reader parked down there is
    // not dragged back up by the browser clamping their scroll to a range that just got shorter
    expect(smallestRange).toBe(rangeWithReport)
  })

  test('blames the outage rather than the filters when a search fails', async ({ page }) => {
    // Only the filter options get through, which is the first call the page makes
    let callsAllowed = 1

    // Stand in for everything after them, so the page comes up but the search behind it does not
    await page.route(`${BACKEND_ORIGIN}/**`, async (route) => {
      // Spend the allowance on the earliest calls
      if (callsAllowed > 0) {
        callsAllowed--
        await route.continue()
        return
      }

      // Everything later finds nothing listening
      await route.abort('connectionrefused')
    })

    // Load the page, which has its filters but no results
    await page.goto(PROBLEMS_PATH)

    // The results are missing because the server is
    await expect(page.getByText(problemsCopy.errors.searchFailed)).toBeVisible({
      timeout: SETTLE_TIMEOUT_MS,
    })

    // Saying otherwise would blame the reader's filters for an outage
    await expect(page.getByText(problemsCopy.emptyState.title)).toBeHidden()
  })

  test('blames the connection rather than the filters when a search is held back', async ({
    page,
  }) => {
    // Load the page with everything working, so there are filters to search with
    await page.goto(PROBLEMS_PATH)
    await page.getByTestId('virtuoso-scroller').waitFor({ timeout: SETTLE_TIMEOUT_MS })

    // The search box in the sidebar, the mobile drawer's copy of it never showing at this width
    const searchBox = page
      .getByPlaceholder(problemsCopy.filters.search.placeholder)
      .filter({ visible: true })

    // Search for something no problem contains, which clears the rows out of the way. They have to
    // be gone already for the next search to have nothing to hide behind, since rows from an earlier
    // search survive one that never runs.
    await searchBox.fill('qwertyuiopasdfgh')
    await expect(page.getByText(problemsCopy.emptyState.title)).toBeVisible({
      timeout: SETTLE_TIMEOUT_MS,
    })

    // Go offline, which holds the next search back rather than failing it
    await goOffline(page)

    // Search again, so the results are missing because the request never left
    await searchBox.fill('qwertyuiopasdfghjkl')

    // The list says what became of the search it stands in for. The heading is what tells this apart
    // from the app-wide offline banner, which says the same thing.
    await expect(page.getByRole('heading', { name: problemsCopy.offlineTitle })).toBeVisible({
      timeout: SETTLE_TIMEOUT_MS,
    })

    // Blaming the filters here would be the same lie as blaming them for an outage
    await expect(page.getByText(problemsCopy.emptyState.title)).toBeHidden()
  })
})

test.describe('problems page refused by the API', () => {
  test('says the request was refused rather than unreachable, and lets it lie', async ({
    page,
  }) => {
    // A rate limiter is the likeliest refusal here: problem search allows 20 requests a minute
    const attempts = await refuseEveryBackendCall(page, 429)

    // Load the page
    await page.goto(PROBLEMS_PATH)

    // Wait for the failure to settle
    await expect(page.getByText(problemsCopy.errors.unexpectedError)).toBeVisible({
      timeout: SETTLE_TIMEOUT_MS,
    })

    // The server answered, so nothing on screen may describe it as unreachable
    await expect(page.getByText(problemsCopy.connectionFailedHint)).toBeHidden()
    await expect(page.getByRole('heading', { name: problemsCopy.connectionFailed })).toBeHidden()

    // A refusal is not retried, so the burst is a single request rather than four
    expect(attempts()).toBe(1)

    // Where the traffic stood once it settled
    const attemptsBeforeReturn = attempts()

    // Come back to the tab, which revives an unreachable backend but must not revive this
    await returnToTab(page)

    // Give any refetch time to leave
    await page.waitForTimeout(1000)

    // Nothing went out: retrying a rate limiter is what provoked it
    expect(attempts()).toBe(attemptsBeforeReturn)

    // Asking for it explicitly is still allowed, since only the reader knows they have waited
    await expect(page.getByRole('button', { name: uiCopy.actions.retry })).toBeVisible()
  })
})
