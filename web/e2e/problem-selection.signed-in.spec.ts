import type { Locator, Page } from '@playwright/test'

import { OPEN_PROPOSAL_PARAM } from '@/components/features/problem-selection/model/selection-routes'

import { BACKEND_ORIGIN, returnToTab } from './support/backend-routes'
import { actionsCopy, areaCopy, editorCopy, SELECTION_PATH } from './support/competitions'
import {
  BILINGUAL,
  cardOf,
  headingOf,
  HINT,
  LANDING_WINDOW_MS,
  ON_OFFER_COUNT,
  OPENED,
  OPENED_ADDRESS,
  REVISION,
  SELECTION_ENDPOINT,
  selectionCopy,
  selectionText,
  SET_ASIDE,
  SETTLE_TIMEOUT_MS,
  SLOVAK_STATEMENT,
  stubNamedReader,
  stubSelection,
  UNWRITTEN,
  USED,
} from './support/problem-selection'
import { expect, test } from './support/test'

/** Where the pool is left when a problem is opened from it, in pixels from the top. */
const POOL_SPOT = 400

/** Where the pool is scrolled to once it is back, short of where it was first left. */
const NEWER_SPOT = 200

/** Where a reader leaves a problem's own page while reading it, in pixels from the top. */
const PROBLEM_SPOT = 300

/** Where a problem's link stands in the view as it is followed, in pixels below the view's top. */
const LINK_SPOT = 200

/** An id the selection holds no problem under, as a link to one taken out of it carries. */
const UNHELD_ID = '00000000-0000-4000-8000-999999999999'

/** A comment a reviewer is partway through writing. */
const COMMENT_DRAFT = 'Fine for the intermediate paper'

/**
 * The problem the address names this instant, read off the page itself, since a step the page pushes onto
 * history reaches Playwright's own copy of the address only later.
 *
 * @param page - The page.
 *
 * @returns The problem's id, or null while the address names none.
 */
function openProblemId(page: Page): Promise<string | null> {
  // Read off the page's own address
  return page.evaluate(
    (param) => new URLSearchParams(window.location.search).get(param),
    OPEN_PROPOSAL_PARAM
  )
}

/**
 * How far down the window is scrolled.
 *
 * @param page - The page.
 *
 * @returns The scroll, in pixels from the top.
 */
function windowScroll(page: Page): Promise<number> {
  // Read off the window itself
  return page.evaluate(() => window.scrollY)
}

/**
 * How far down the window could be scrolled at most, which is how much taller the page is than the window.
 *
 * @param page - The page.
 *
 * @returns The furthest scroll, in pixels from the top.
 */
function furthestScroll(page: Page): Promise<number> {
  // The page's height past the window's
  return page.evaluate(() => document.documentElement.scrollHeight - window.innerHeight)
}

/**
 * How far below the view's top an element stands.
 *
 * @param element - The element.
 *
 * @returns The distance, in pixels, negative for an element starting above the view.
 */
function topInView(element: Locator): Promise<number> {
  // Read off the element itself
  return element.evaluate((node) => node.getBoundingClientRect().top)
}

/**
 * Scrolls the window to a spot, handing back once the scroll has been dispatched, as a reader's own scroll
 * always is before their next click.
 *
 * @param page - The page.
 * @param top - The spot, in pixels from the top.
 */
async function scrollWindowTo(page: Page, top: number): Promise<void> {
  // Scrolled there, and waited on until the page has heard it
  await page.evaluate(
    (spot) =>
      new Promise<void>((resolve) => {
        // Handed back once the scroll is heard
        window.addEventListener('scroll', () => resolve(), { once: true })

        // Jumped there, since the site otherwise scrolls smoothly
        window.scrollTo({ top: spot, behavior: 'instant' })
      }),
    top
  )

  // There, which a page too short for the spot would have cut short
  expect(await windowScroll(page)).toBe(top)
}

/**
 * Waits until the page is two frames on, by which time it has painted whatever the last step set off.
 *
 * @param page - The page.
 */
async function twoFramesLater(page: Page): Promise<void> {
  // Waited out inside the page
  await page.evaluate(
    () =>
      new Promise<void>((resolve) => {
        // The next frame, and the one after it
        requestAnimationFrame(() => requestAnimationFrame(() => resolve()))
      })
  )
}

/**
 * Slows the page's processor down as a slow phone runs it, so the work the page puts off for what is out of
 * sight is still pending when the reader's next step comes.
 *
 * @param page - The page.
 */
async function slowDown(page: Page): Promise<void> {
  // A line to the browser itself
  const session = await page.context().newCDPSession(page)

  // The page's processor slowed, for the rest of the test
  await session.send('Emulation.setCPUThrottlingRate', { rate: 6 })
}

/**
 * Clicks a link where it sits. Playwright's own click scrolls its target into view first, which would move the
 * very spot a test is measuring.
 *
 * @param page - The page.
 * @param name - The link's accessible name, or a part of it.
 */
export async function clickInPlace(page: Page, name: string): Promise<void> {
  // A plain click, fired on the link itself
  await page.getByRole('link', { name }).evaluate((element: HTMLElement) => element.click())
}

/**
 * Clicks a link twice where it sits, the second click landing before the page has answered the first.
 *
 * @param link - The link.
 */
async function clickTwiceAtOnce(link: Locator): Promise<void> {
  // Both clicks, fired on the link itself in one go
  await link.evaluate((element: HTMLElement) => {
    // The first click
    element.click()

    // And the second, before anything has rendered
    element.click()
  })
}

/**
 * One language on the language switch in view.
 *
 * @param page - The page.
 * @param language - The language's code.
 *
 * @returns The language's option.
 */
function languageOption(page: Page, language: string) {
  // The option on the one switch showing, the pool's being out of sight while a problem is open
  return page
    .getByRole('radiogroup', { name: selectionCopy.language.label })
    .getByRole('radio', { name: language, exact: true })
}

/**
 * Opens the pool, leaves it at {@link POOL_SPOT}, and opens {@link OPENED} from its card.
 *
 * @param page - The page.
 */
async function openFromPool(page: Page): Promise<void> {
  // The pool
  await page.goto(SELECTION_PATH)

  // Once every card is drawn
  await expect(page.getByRole('article')).toHaveCount(ON_OFFER_COUNT, {
    timeout: SETTLE_TIMEOUT_MS,
  })

  // Left part of the way down
  await scrollWindowTo(page, POOL_SPOT)

  // The problem, opened from its card
  await clickInPlace(page, OPENED.title)

  // Its page
  await expect(headingOf(page, OPENED)).toBeVisible()
}

test.describe("the selection's address and history", () => {
  test('opens a clicked problem at its top, and names it in the address', async ({ page }) => {
    // A reviewer whose selection holds a pool of problems
    await stubSelection(page, 'selection')

    // A problem opened from part of the way down the pool
    await openFromPool(page)

    // Named in the address, so the link can be shared
    await expect(page).toHaveURL(OPENED_ADDRESS)

    // On a page of its own, the pool out of sight
    await expect(page.getByRole('article')).toHaveCount(1)

    // The problem runs long enough to have stayed where the pool was left, so its top is the page's doing
    expect(await furthestScroll(page)).toBeGreaterThanOrEqual(POOL_SPOT)

    // At its top the moment it shows, with no scroll still under way
    expect(await windowScroll(page)).toBe(0)
  })

  test('returns by the Pool link to wherever the pool was last left', async ({ page }) => {
    // A reviewer whose selection holds a pool of problems
    await stubSelection(page, 'selection')

    // A problem opened from part of the way down the pool
    await openFromPool(page)

    // Back
    await page.goBack()

    // Under the pool's own address
    await expect(page).toHaveURL(SELECTION_PATH)

    // The pool again
    await expect(page.getByRole('article')).toHaveCount(ON_OFFER_COUNT)

    // Where it was left
    await expect.poll(() => windowScroll(page)).toBe(POOL_SPOT)

    // The pool scrolled somewhere else
    await scrollWindowTo(page, NEWER_SPOT)

    // Forward
    await page.goForward()

    // The problem again
    await expect(headingOf(page, OPENED)).toBeVisible()

    // Where it was left, which is its top
    await expect.poll(() => windowScroll(page)).toBe(0)

    // Back to the pool by the link on the problem's page
    await clickInPlace(page, selectionCopy.detail.backToPool)

    // Under the pool's own address
    await expect(page).toHaveURL(SELECTION_PATH)

    // The pool again
    await expect(page.getByRole('article')).toHaveCount(ON_OFFER_COUNT)

    // Where it was scrolled since, rather than where the problem was first opened from
    await expect.poll(() => windowScroll(page)).toBe(NEWER_SPOT)

    // Back once more
    await page.goBack()

    // Onto the problem's address, the link having been a step of its own
    await expect(page).toHaveURL(OPENED_ADDRESS)

    // The problem again
    await expect(headingOf(page, OPENED)).toBeVisible()
  })

  test('brings the pool back with the opened problem where it stood, whatever left the pool above it', async ({
    page,
  }) => {
    // The clock under the test's hand, so the next read comes when the test says
    await page.clock.install()

    // A reviewer whose selection holds a pool of problems
    const answerSelectionWith = await stubSelection(page, 'selection')

    // The pool
    await page.goto(SELECTION_PATH)

    // Once every card is drawn
    await expect(page.getByRole('article')).toHaveCount(ON_OFFER_COUNT, {
      timeout: SETTLE_TIMEOUT_MS,
    })

    // A problem's link in the pool, a card or two down
    const link = cardOf(page, OPENED).getByRole('link', { name: OPENED.title })

    // Scrolled to, so the link stands part of the way down the view
    await scrollWindowTo(
      page,
      Math.round((await windowScroll(page)) + (await topInView(link))) - LINK_SPOT
    )

    // Where the link stands in the view
    const linkTop = await topInView(link)

    // The problem, opened by its link
    await clickInPlace(page, OPENED.title)

    // Its page
    await expect(headingOf(page, OPENED)).toBeVisible()

    // A later read, which revises the problem and sets aside the pool's first one
    answerSelectionWith('later')

    // Long enough for the selection to be read again
    await page.clock.fastForward('00:31')

    // Once the read has landed, which the revision on the problem's page shows
    await expect(page.getByRole('article').getByText(REVISION)).toBeVisible({
      timeout: SETTLE_TIMEOUT_MS,
    })

    // Back to the pool by the link on the problem's page
    await clickInPlace(page, selectionCopy.detail.backToPool)

    // The pool again, the problem set aside gone from above
    await expect(page.getByRole('article')).toHaveCount(ON_OFFER_COUNT - 1)

    // The link where it stood, give or take the pixel a scroll rounds to
    expect(Math.abs((await topInView(link)) - linkTop)).toBeLessThanOrEqual(1)
  })

  test("moves focus onto an opened problem's name, and back onto its link in the pool", async ({
    page,
  }) => {
    // A reviewer whose selection holds a pool of problems
    await stubSelection(page, 'selection')

    // The pool
    await page.goto(SELECTION_PATH)

    // Once every card is drawn
    await expect(page.getByRole('article')).toHaveCount(ON_OFFER_COUNT, {
      timeout: SETTLE_TIMEOUT_MS,
    })

    // A problem's link in the pool
    const link = cardOf(page, OPENED).getByRole('link', { name: OPENED.title })

    // The problem's link followed from the keyboard
    await link.press('Enter')

    // Focus on the problem's name, which the next Tab goes on from
    await expect(headingOf(page, OPENED)).toBeFocused()

    // The Pool link followed from the keyboard as well
    await page.getByRole('link', { name: selectionCopy.detail.backToPool }).press('Enter')

    // Focus back on the problem's link
    await expect(link).toBeFocused()

    // Back, onto the problem again
    await page.goBack()

    // Focus on the problem's name again, a step in history moving focus too
    await expect(headingOf(page, OPENED)).toBeFocused()
  })

  test('goes back to the pool by the left arrow, unless the comment editor, the tabs or a dialog has the key', async ({
    page,
  }) => {
    // A reviewer with a username, which the discussion asks for before it takes a comment
    await stubNamedReader(page)

    // Whose selection holds a pool of problems
    await stubSelection(page, 'selection')

    // A problem's discussion
    await page.goto(`${OPENED_ADDRESS}&tab=comments`)

    // The discussion's editor
    const editor = page.getByRole('tabpanel').locator('textarea')

    // A comment being written in it
    await editor.fill(COMMENT_DRAFT, { timeout: SETTLE_TIMEOUT_MS })

    // The left arrow, moving the caret back a letter
    await editor.press('ArrowLeft')

    // The problem still open
    expect(await openProblemId(page)).toBe(OPENED.id)

    // The editor's button opening its emoji picker
    const emojiButton = page
      .getByRole('tabpanel')
      .getByRole('button', { name: editorCopy.emojiPicker.title })

    // The picker, opened
    await emojiButton.click()

    // One of its emoji
    const emoji = page.locator('button.epr-emoji').first()

    // The left arrow on it, which the picker takes for its own
    await emoji.press('ArrowLeft', { timeout: SETTLE_TIMEOUT_MS })

    // The problem still open
    expect(await openProblemId(page)).toBe(OPENED.id)

    // The picker, put away by its button
    await emojiButton.click()

    // Gone
    await expect(emoji).toHaveCount(0)

    // The left arrow on the discussion's tab
    await page.getByRole('tab', { name: selectionCopy.detail.commentsTab }).press('ArrowLeft')

    // Moving onto the conversations
    await expect(
      page
        .getByRole('tablist', { name: selectionCopy.detail.tabsLabel })
        .getByRole('tab', { selected: true })
    ).toContainText(selectionCopy.detail.conversationsTab)

    // The problem still open
    expect(await openProblemId(page)).toBe(OPENED.id)

    // The problem's menu, opened
    await page
      .getByRole('button', { name: selectionText('actions.moreFor', { number: OPENED.number }) })
      .click()

    // Its delete, picked
    await page.getByRole('menuitem', { name: actionsCopy.delete, exact: true }).click()

    // The question asked before the problem is deleted
    const question = page.getByRole('dialog', {
      name: selectionText('actions.deleteTitle', { number: OPENED.number }),
    })

    // On screen, holding the focus
    await expect(question).toBeFocused()

    // The left arrow, while the question waits on an answer
    await page.keyboard.press('ArrowLeft')

    // The problem still open
    expect(await openProblemId(page)).toBe(OPENED.id)

    // And the question with it
    await expect(question).toHaveCount(1)

    // The question, put away
    await question.getByRole('button', { name: actionsCopy.cancel }).click()

    // Gone
    await expect(question).toHaveCount(0)

    // Focus on the problem's name, since closing the question now and then hands it to the menu instead
    await headingOf(page, OPENED).focus()

    // The left arrow once more, with nothing left to keep it
    await page.keyboard.press('ArrowLeft')

    // Under the pool's own address
    await expect(page).toHaveURL(SELECTION_PATH)

    // The pool again
    await expect(page.getByRole('article')).toHaveCount(ON_OFFER_COUNT)
  })

  test('keeps a problem where it was scrolled to when the selection is read again', async ({
    page,
  }) => {
    // The clock under the test's hand, so the next read comes when the test says
    await page.clock.install()

    // A reviewer whose selection holds a pool of problems
    const answerSelectionWith = await stubSelection(page, 'selection')

    // A problem opened from the pool
    await openFromPool(page)

    // Read part of the way down
    await scrollWindowTo(page, PROBLEM_SPOT)

    // The problem's author revising it meanwhile
    answerSelectionWith('later')

    // Long enough for the selection to be read again
    await page.clock.fastForward('00:31')

    // The revision on the problem's page, which the read again brought
    await expect(page.getByRole('article').getByText(REVISION)).toBeVisible({
      timeout: SETTLE_TIMEOUT_MS,
    })

    // Still where it was read to
    expect(await windowScroll(page)).toBe(PROBLEM_SPOT)
  })

  test('adds a single step to history for a link clicked twice in a row', async ({ page }) => {
    // A reviewer whose selection holds a pool of problems
    await stubSelection(page, 'selection')

    // The pool
    await page.goto(SELECTION_PATH)

    // Once every card is drawn
    await expect(page.getByRole('article')).toHaveCount(ON_OFFER_COUNT, {
      timeout: SETTLE_TIMEOUT_MS,
    })

    // A card's link clicked twice, the second click landing before the page has answered the first
    await clickTwiceAtOnce(page.getByRole('link', { name: OPENED.title }))

    // The problem's page
    await expect(headingOf(page, OPENED)).toBeVisible()

    // The Pool link clicked twice at once as well
    await clickTwiceAtOnce(page.getByRole('link', { name: selectionCopy.detail.backToPool }))

    // The pool again
    await expect(page.getByRole('article')).toHaveCount(ON_OFFER_COUNT)

    // Back
    await page.goBack()

    // Onto the problem, a single step away
    await expect(page).toHaveURL(OPENED_ADDRESS)

    // Back again
    await page.goBack()

    // Onto the pool it was opened from, a single step away again
    await expect(page).toHaveURL(SELECTION_PATH)
  })

  test('leaves a click held with a modifier to the browser, which opens a tab of its own', async ({
    page,
  }) => {
    // A reviewer whose selection holds a pool of problems
    await stubSelection(page, 'selection')

    // Whatever the new tab asks the backend refused, the tab being the browser's and none of this test's
    await page.context().route(`${BACKEND_ORIGIN}/**`, (route) => route.abort('connectionrefused'))

    // The pool
    await page.goto(SELECTION_PATH)

    // Once every card is drawn
    await expect(page.getByRole('article')).toHaveCount(ON_OFFER_COUNT, {
      timeout: SETTLE_TIMEOUT_MS,
    })

    // The problem's address asked for as a page of its own, which a tab the browser opens does. Playwright
    // now and then loses a tab opened behind a page this long, or the address it reaches, while the request
    // itself always reaches the context
    const tabRequest = page
      .context()
      .waitForEvent(
        'request',
        (request) => request.isNavigationRequest() && request.url().endsWith(OPENED_ADDRESS)
      )

    // A card's link clicked with the key that opens a link in a new tab
    await page.getByRole('link', { name: OPENED.title }).click({ modifiers: ['ControlOrMeta'] })

    // The problem's address, asked for by the browser
    await tabRequest

    // This tab still on the pool's address
    await expect(page).toHaveURL(SELECTION_PATH)

    // The pool still showing
    await expect(page.getByRole('article')).toHaveCount(ON_OFFER_COUNT)
  })

  test('opens a shared link to a problem on a cold load', async ({ page }) => {
    // A reviewer whose selection holds a pool of problems
    await stubSelection(page, 'selection')

    // The link, opened in a fresh tab
    await page.goto(OPENED_ADDRESS)

    // The problem
    await expect(headingOf(page, OPENED)).toBeVisible({ timeout: SETTLE_TIMEOUT_MS })

    // On a page of its own
    await expect(page.getByRole('article')).toHaveCount(1)

    // The Pool link on the problem's page, followed
    await clickInPlace(page, selectionCopy.detail.backToPool)

    // Onto the pool's own address
    await expect(page).toHaveURL(SELECTION_PATH)

    // The pool behind the problem, every card of it
    await expect(page.getByRole('article')).toHaveCount(ON_OFFER_COUNT)
  })

  test('says a link names no problem the selection holds, and leads back to the pool', async ({
    page,
  }) => {
    // A reviewer whose selection holds a pool of problems
    await stubSelection(page, 'selection')

    // A link to a problem the selection no longer holds
    await page.goto(`${SELECTION_PATH}?problem=${UNHELD_ID}`)

    // Said so
    await expect(page.getByText(selectionCopy.detail.notInPool)).toBeVisible({
      timeout: SETTLE_TIMEOUT_MS,
    })

    // The Pool link, followed
    await clickInPlace(page, selectionCopy.detail.backToPool)

    // The pool, every card of it
    await expect(page.getByRole('article')).toHaveCount(ON_OFFER_COUNT)
  })

  test('marks a problem a link opens as set aside, or as used in a round', async ({ page }) => {
    // A reviewer whose selection holds a pool of problems
    await stubSelection(page, 'selection')

    // A link to the problem the reviewers set aside
    await page.goto(`${SELECTION_PATH}?problem=${SET_ASIDE.id}`)

    // Marked so on its page
    await expect(
      page.getByRole('article').getByText(selectionCopy.filing.setAside, { exact: true })
    ).toBeVisible({ timeout: SETTLE_TIMEOUT_MS })

    // A link to the problem a round took
    await page.goto(`${SELECTION_PATH}?problem=${USED.id}`)

    // Marked so on its page
    await expect(
      page.getByRole('article').getByText(selectionCopy.filing.used, { exact: true })
    ).toBeVisible({ timeout: SETTLE_TIMEOUT_MS })
  })

  test("closes a problem's hints when history moves off the pool, however soon it comes back", async ({
    page,
  }) => {
    // A reviewer on a slow phone
    await slowDown(page)

    // Whose selection holds a pool of problems
    await stubSelection(page, 'selection')

    // A problem opened from the pool
    await openFromPool(page)

    // And Back, so there is a step to go Forward to
    await page.goBack()

    // The hints of another problem, opened on its card
    await cardOf(page, BILINGUAL).getByRole('button', { name: areaCopy.hints, exact: true }).click()

    // Up over the pool
    await expect(page.getByRole('dialog').getByText(HINT)).toBeVisible()

    // Forward
    await page.goForward()

    // The problem's page
    await expect(headingOf(page, OPENED)).toBeVisible()

    // Straight Back to the pool
    await page.goBack()

    // Under the pool's own address
    await expect(page).toHaveURL(SELECTION_PATH)

    // Once the pool has had a moment to bring anything back with it
    await twoFramesLater(page)

    // The hints still closed
    await expect(page.getByRole('dialog')).toHaveCount(0)

    // And every card within reach, nothing laid over them
    await expect(page.getByRole('article')).toHaveCount(ON_OFFER_COUNT)
  })
})

test.describe('reading the selection', () => {
  test('turns away an account that does not prepare competitions, and asks no more', async ({
    page,
  }) => {
    // The clock under the test's hand, so a later read would come when the test says
    await page.clock.install()

    // An account the backend refuses the selection to
    await stubSelection(page, 'forbidden')

    // How many reads of the selection have gone out
    let reads = 0

    // Every read of the selection, counted as it goes out
    page.on('request', (request) => {
      // One more, if it is the selection's
      if (request.url() === SELECTION_ENDPOINT) reads++
    })

    // The selection
    await page.goto(SELECTION_PATH)

    // Said who it is for
    await expect(page.getByText(selectionCopy.access.forbidden)).toBeVisible({
      timeout: SETTLE_TIMEOUT_MS,
    })

    // With no retry on offer, since a refusal is the same however often it is asked
    await expect(page.getByRole('button', { name: actionsCopy.retry })).toHaveCount(0)

    // How many reads it took to be refused
    const readsToRefusal = reads

    // Long enough for a pool on screen to be read again
    await page.clock.fastForward('00:31')

    // And a return from another tab, which reads a pool on screen again too
    await returnToTab(page)

    // Time for a read the clock or the return to the tab set off to go out
    await page.waitForTimeout(LANDING_WINDOW_MS)

    // None did, the refusal being left to stand
    expect(reads).toBe(readsToRefusal)
  })

  test('offers another try when the read fails, and the pool once one lands', async ({ page }) => {
    // A read the backend fails
    const answerSelectionWith = await stubSelection(page, 'failure')

    // The selection
    await page.goto(SELECTION_PATH)

    // Said it could not be loaded
    await expect(page.getByText(selectionCopy.access.failed)).toBeVisible({
      timeout: SETTLE_TIMEOUT_MS,
    })

    // The backend answering again
    answerSelectionWith('selection')

    // Another try
    await page.getByRole('button', { name: actionsCopy.retry }).click()

    // The pool, every card of it
    await expect(page.getByRole('article')).toHaveCount(ON_OFFER_COUNT, {
      timeout: SETTLE_TIMEOUT_MS,
    })
  })

  test('keeps the pool on screen when a later read fails', async ({ page }) => {
    // The clock under the test's hand, so the next read comes when the test says
    await page.clock.install()

    // A reviewer whose selection holds a pool of problems
    const answerSelectionWith = await stubSelection(page, 'selection')

    // The pool
    await page.goto(SELECTION_PATH)

    // Once every card is drawn
    await expect(page.getByRole('article')).toHaveCount(ON_OFFER_COUNT, {
      timeout: SETTLE_TIMEOUT_MS,
    })

    // The backend failing from here on
    answerSelectionWith('failure')

    // The next read, failed
    const failedRead = page.waitForResponse(
      (response) => response.url() === SELECTION_ENDPOINT && response.status() === 404
    )

    // Long enough for the selection to be read again
    await page.clock.fastForward('00:31')

    // Once the failure has landed
    await failedRead

    // And the page has had a moment to show it
    await twoFramesLater(page)

    // No word of it standing in for the pool
    await expect(page.getByText(selectionCopy.access.failed)).toHaveCount(0)

    // The pool, every card of it
    await expect(page.getByRole('article')).toHaveCount(ON_OFFER_COUNT)
  })
})

test.describe('the languages a problem is read in', () => {
  test('reads the pool in another language, and a problem opened from it in that one where it can', async ({
    page,
  }) => {
    // A reviewer whose selection holds a pool of problems
    await stubSelection(page, 'selection')

    // The pool
    await page.goto(SELECTION_PATH)

    // Once every card is drawn
    await expect(page.getByRole('article')).toHaveCount(ON_OFFER_COUNT, {
      timeout: SETTLE_TIMEOUT_MS,
    })

    // Read in Slovak
    await languageOption(page, 'sk').click()

    // A problem written in English alone says English is standing in
    await expect(cardOf(page, OPENED)).toContainText(
      selectionCopy.text.fallback.replace('{missing}', 'SK').replace('{shown}', 'EN')
    )

    // The problem written in Slovak reads in it
    await expect(cardOf(page, BILINGUAL)).toContainText(SLOVAK_STATEMENT)

    // Opened
    await cardOf(page, BILINGUAL).getByRole('link', { name: BILINGUAL.title }).click()

    // Its page
    await expect(headingOf(page, BILINGUAL)).toBeVisible()

    // In Slovak
    await expect(languageOption(page, 'sk')).toBeChecked()

    // Back to the pool by the link on the problem's page
    await page.getByRole('link', { name: selectionCopy.detail.backToPool }).click()

    // Still read in Slovak
    await expect(languageOption(page, 'sk')).toBeChecked()

    // The problem written in English alone, opened
    await cardOf(page, OPENED).getByRole('link', { name: OPENED.title }).click()

    // Its page
    await expect(headingOf(page, OPENED)).toBeVisible()

    // In English
    await expect(languageOption(page, 'en')).toBeChecked()

    // With Slovak out of reach, nothing of it being written in Slovak
    await expect(languageOption(page, 'sk')).toBeDisabled()

    // And Czech the same
    await expect(languageOption(page, 'cs')).toBeDisabled()
  })

  test('notes on each card what its problem still lacks, language by language', async ({
    page,
  }) => {
    // A reviewer whose selection holds a pool of problems
    await stubSelection(page, 'selection')

    // The pool
    await page.goto(SELECTION_PATH)

    // Once every card is drawn
    await expect(page.getByRole('article')).toHaveCount(ON_OFFER_COUNT, {
      timeout: SETTLE_TIMEOUT_MS,
    })

    // A function which writes a note naming some languages, the way the card does
    const note = (template: string, languages: string) => template.replace('{languages}', languages)

    // A problem in English alone, unsolved: not written in Slovak or Czech
    await expect(
      cardOf(page, OPENED).getByText(note(selectionCopy.filing.unwritten, 'SK, CS'), {
        exact: true,
      })
    ).toBeVisible()

    // And not solved in English, the one language it is written in
    await expect(
      cardOf(page, OPENED).getByText(note(selectionCopy.filing.noSolution, 'EN'), { exact: true })
    ).toBeVisible()

    // A problem in English and Slovak, solved in English: not written in Czech
    await expect(
      cardOf(page, BILINGUAL).getByText(note(selectionCopy.filing.unwritten, 'CS'), { exact: true })
    ).toBeVisible()

    // And not solved in Slovak
    await expect(
      cardOf(page, BILINGUAL).getByText(note(selectionCopy.filing.noSolution, 'SK'), {
        exact: true,
      })
    ).toBeVisible()

    // A problem written in no language yet: not written in any of them
    await expect(
      cardOf(page, UNWRITTEN).getByText(note(selectionCopy.filing.unwritten, 'SK, CS, EN'), {
        exact: true,
      })
    ).toBeVisible()

    // With a word where its statement would be
    await expect(cardOf(page, UNWRITTEN).getByText(selectionCopy.text.none)).toBeVisible()
  })
})
