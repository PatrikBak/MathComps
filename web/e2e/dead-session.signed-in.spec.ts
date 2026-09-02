import type { Page } from '@playwright/test'

import { MATHILDA_NAME } from '@/constants/mathilda'

import messages from '../messages/en.json'
import { BACKEND_ORIGIN, PROBLEMS_PATH, recordNotices } from './support/backend-routes'
import { apiErrorsCopy, chatCopy, LIST_PATH } from './support/competitions'
import { installHostedBackend } from './support/hosted-backend'
import { searchAnswerWith, stubProblemActions, stubSearchAnswer } from './support/problem-actions'
import { dropSessionWithoutNotifying } from './support/session'
import { expect, test } from './support/test'

/** How long a surface gets to boot Clerk, work out who is reading, and settle on what to show. */
const SETTLE_TIMEOUT_MS = 15_000

/** The copy every surface waiting on a connection reads under. */
const networkCopy = messages.ui.network

/** The copy the problem cards and their notices read under. */
const problemsCopy = messages.problems

/** The problem the reader acts on. */
const EDITED = 'tst-2020-1'

/** Where the reader's own conversations are listed from. */
const MY_DEFENSES_PATH = '/defense/sessions/mine'

declare global {
  interface Window {
    /** Tells the test run that the copy shown between attempts at a read is on screen. */
    reportRetrying: () => void
  }
}

/**
 * Watches for the copy a surface shows between attempts at a read it is retrying.
 *
 * A retry is over long before an assertion can be reached, so a check taken afterwards passes whether
 * one happened or not. Watching for it as it arrives is what tells a read that settled at once from
 * one that settled after a burst of attempts.
 *
 * @param page - The page to watch.
 *
 * @returns How many times the copy has reached the screen so far.
 */
async function countRetryingFrames(page: Page): Promise<() => number> {
  // Every time the copy was found on screen
  let frames = 0

  // The channel the page reports each sighting through
  await page.exposeFunction('reportRetrying', () => {
    frames += 1
  })

  // Watch the document already open, which is the one the read under test happens on
  await page.evaluate((retrying) => {
    // A function which reports the copy whenever the page is holding it
    const reportRetryingCopy = () => {
      if (document.body.innerText.includes(retrying)) {
        window.reportRetrying()
      }
    }

    // Text arriving counts as much as a node arriving, since the copy is only readable once it has both
    new MutationObserver(reportRetryingCopy).observe(document, {
      childList: true,
      subtree: true,
      characterData: true,
    })
  }, networkCopy.retrying)

  // Hand back the count on each read
  return () => frames
}

test.describe('a reader whose session died under them', () => {
  test('settles a read at once instead of retrying it as a lost connection', async ({ page }) => {
    // A backend that answers everything this surface asks of it
    await installHostedBackend(page, 'running')

    // Every read of the reader's own conversations, which is the call a dead session cuts off
    const reads: string[] = []

    // Watched at the endpoint itself, above the backend standing in for it
    await page.route(`${BACKEND_ORIGIN}${MY_DEFENSES_PATH}`, async (route) => {
      // Recorded before it is answered
      reads.push(route.request().url())

      // Answered by the backend standing in underneath this
      await route.fallback()
    })

    // Open a page of the app, signed in
    await page.goto(LIST_PATH)

    // The menu the conversations hang off, which appears only once Clerk resolves a user
    const userMenu = page.locator('#user-menu-trigger')
    await expect(userMenu).toBeVisible({ timeout: SETTLE_TIMEOUT_MS })

    // Watch for the copy a read shows between attempts
    const retryingFrames = await countRetryingFrames(page)

    // The session goes, without React hearing about it
    await dropSessionWithoutNotifying(page)

    // The menu the conversations hang off
    await userMenu.click()

    // And the conversations themselves, which is a read that insists on a signed-in reader
    await page.getByRole('menuitem', { name: MATHILDA_NAME }).click()

    // The read gives up and says so
    await expect(page.getByText(chatCopy.historyError)).toBeVisible({ timeout: SETTLE_TIMEOUT_MS })

    // Having never reached the backend, since there was no token to ask it with
    expect(reads).toEqual([])

    // And having never told the reader it was trying again, which is what a lost connection earns
    expect(retryingFrames()).toBe(0)
  })

  test('names the dead session when an action of the reader’s own fails on it', async ({
    page,
  }) => {
    // An archive holding one problem the reader has liked
    await stubSearchAnswer(page, searchAnswerWith({ [EDITED]: { liked: true } }))

    // The endpoints an action goes to, which nothing here should reach
    const actions = await stubProblemActions(page)

    // Open the reader's likes
    await page.goto(`${PROBLEMS_PATH}?favoritesOnly=true`)

    // A row to act on
    const row = page.locator(`[data-problem-slug="${EDITED}"]`)
    await expect(row).toBeVisible({ timeout: SETTLE_TIMEOUT_MS })

    // Every notice the reader is shown from here on
    const notices = await recordNotices(page)

    // The session goes, without React hearing about it
    await dropSessionWithoutNotifying(page)

    // The reader takes their like back
    await row.locator(`button[title="${problemsCopy.unlike}"]`).click()

    // And is told what actually went wrong
    await expect
      .poll(() => notices(), { timeout: SETTLE_TIMEOUT_MS })
      .toContain(apiErrorsCopy.Unauthenticated)

    // The action never left the browser, so nothing but the dead session can account for the notice
    expect(actions()).toEqual([])
  })
})
