import type { Page } from '@playwright/test'

import messages from '../messages/en.json'
import {
  BACKEND_ORIGIN,
  failEveryBackendCall,
  PROBLEMS_PATH,
  refuseEveryBackendCall,
  SEARCH_PATH,
} from './support/backend-routes'
import {
  searchAnswerWith,
  searchAnswerWithMoreToCome,
  stubSearchRule,
} from './support/problem-actions'
import { expect, test } from './support/test'

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

/** A word no problem carries, which is how a search is made to come back with nothing. */
const NOTHING_MATCHES = 'qwertyuiopasdfgh'

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

/**
 * Stands in for the archive, answering searches until the test takes it away.
 *
 * The page it answers with is a full one with another behind it, since a list has to have rows before
 * it can be scrolled to its end and has to know more exist before it asks for them. The switch is
 * handed back, so the moment the archive goes is the test's to pick.
 *
 * @param page - The page to intercept searches on.
 *
 * @returns A function which takes the archive away, from the next search on.
 */
async function stubArchiveUntilBroken(page: Page): Promise<() => void> {
  // Whether the archive is still answering
  let isBroken = false

  // The answer it gives while it is up
  await stubSearchRule(page, () => searchAnswerWithMoreToCome())

  // And the outage, which overrides that answer once it starts: a later route is the one Playwright
  // tries first, and falling back reaches the one above while there is nothing wrong
  await page.route(`${BACKEND_ORIGIN}${SEARCH_PATH}`, async (route) => {
    // Nothing lands once the archive has gone
    if (isBroken) {
      await route.abort('connectionrefused')
      return
    }

    // Until then, the answer underneath this one
    await route.fallback()
  })

  // Hand back the switch
  return () => {
    isBroken = true
  }
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
  test('explains a problem that failed to load instead of sitting on skeletons', async ({
    page,
  }) => {
    // The archive answers the list, so what is missing is the problem rather than the page around it
    await stubSearchRule(page, () => searchAnswerWithMoreToCome())

    // The problem itself never arrives
    await page.route(`${BACKEND_ORIGIN}/problems/any-problem-slug*`, async (route) => {
      await route.abort('connectionrefused')
    })

    // Open the page on a problem, whose slug never matters because the call never lands
    await page.goto(`${PROBLEMS_PATH}?id=any-problem-slug`)

    // Without the problem there is nothing to render, so the page has to say why and offer a way out
    await expect(page.getByRole('button', { name: uiCopy.actions.retry })).toBeVisible({
      timeout: SETTLE_TIMEOUT_MS,
    })
  })

  test('sends a reader whose problem does not exist back to the list', async ({ page }) => {
    // The list the reader is sent back to
    await stubSearchRule(page, () => searchAnswerWith({}))

    // Stand in for the lookup alone, answering it the way the archive answers a slug it does not
    // hold: a named refusal rather than a connection that went nowhere, which is the whole of what
    // tells the page to leave instead of offering another go
    await page.route(`${BACKEND_ORIGIN}/problems/no-such-problem*`, async (route) => {
      await route.fulfill({
        status: 404,
        contentType: 'application/problem+json',
        body: JSON.stringify({ status: 404, errorCode: 'ProblemNotFound' }),
      })
    })

    // Ask for a problem that cannot be found
    await page.goto(`${PROBLEMS_PATH}?id=no-such-problem`)

    // A missing problem is not a connection to wait on, so the reader is returned to the full list
    await expect(page).toHaveURL(PROBLEMS_PATH, { timeout: SETTLE_TIMEOUT_MS })

    // And is offered nothing to retry, because another attempt would find it just as absent
    await expect(page.getByRole('button', { name: uiCopy.actions.retry })).toBeHidden()
  })

  test('reports a failed load-more once, under the rows it could not extend', async ({ page }) => {
    // The archive, which answers until this test takes it away
    const breakArchive = await stubArchiveUntilBroken(page)

    // Load the page
    await page.goto(PROBLEMS_PATH)

    // Wait for results, since the point is what happens to a list that already has rows
    const scroller = page.getByTestId('virtuoso-scroller')
    await scroller.waitFor({ timeout: SETTLE_TIMEOUT_MS })

    // Now take the archive away
    breakArchive()

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
    // The archive, which answers until this test takes it away
    const breakArchive = await stubArchiveUntilBroken(page)

    // Load the page
    await page.goto(PROBLEMS_PATH)

    // Wait for results, since this is about a list that already has rows
    const scroller = page.getByTestId('virtuoso-scroller')
    await scroller.waitFor({ timeout: SETTLE_TIMEOUT_MS })

    // Now take the archive away
    breakArchive()

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
    // The archive, which answers until this test takes it away
    const breakArchive = await stubArchiveUntilBroken(page)

    // Load the page
    await page.goto(PROBLEMS_PATH)

    // Wait for rows. The page's filters ride back on the same answer as its first rows, so until it
    // has come up there is no distinction left between the archive being down and the filters
    // matching nothing.
    await page.getByTestId('virtuoso-scroller').waitFor({ timeout: SETTLE_TIMEOUT_MS })

    // Now take the archive away
    breakArchive()

    // A search the reader sets off themselves, which finds nothing listening
    await page
      .getByRole('textbox', { name: problemsCopy.filters.search.label })
      .fill('nothing listening')

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
    // The archive, which matches everything until a search asks for a word no problem carries
    await stubSearchRule(page, (query) =>
      query.parameters.searchText === NOTHING_MATCHES
        ? searchAnswerWith({})
        : searchAnswerWithMoreToCome()
    )

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
    await searchBox.fill(NOTHING_MATCHES)
    await expect(page.getByText(problemsCopy.emptyState.title)).toBeVisible({
      timeout: SETTLE_TIMEOUT_MS,
    })

    // Go offline, which holds the next search back rather than failing it
    await goOffline(page)

    // Search again, so the results are missing because the request never left
    await searchBox.fill(`${NOTHING_MATCHES}-again`)

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
