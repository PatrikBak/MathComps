import { PROBLEM_CARD_ATTRIBUTE } from '@/components/features/problems/constants/problem-list-attributes'
import { URL_PARAMS } from '@/components/features/problems/utils/search-url-serialization'

import messages from '../messages/en.json'
import { locationParam } from './support/address'
import { errorsCopy } from './support/archive-filters'
import { PROBLEMS_PATH } from './support/backend-routes'
import { QUIET_MS } from './support/facets'
import {
  breakProblemRead,
  searchAnswerWith,
  searchAnswerWithMoreToCome,
  stubMissingProblem,
  stubSearchAnswer,
  stubSearchRule,
  stubSingleProblem,
} from './support/problem-actions'
import { expect, SETTLE_TIMEOUT_MS, test } from './support/test'
import { recordNotices } from './support/watchers'

/** The copy the archive reads under, taken from the app's own English messages. */
const problemsCopy = messages.problems

/** The copy every modal's chrome reads under. */
const modalCopy = messages.ui.modal

/** The problem on the list whose solution the reader opens. */
const LISTED_PROBLEM = 'listed-problem'

/** The listed problem's solution, in plain words so the text reads the same rendered. */
const LISTED_SOLUTION = 'Pair every letter with the one after it.'

/** A problem a shared link names, on none of the pages the list has loaded. */
const FAR_PROBLEM = 'far-problem'

/** The far problem's solution. */
const FAR_SOLUTION = 'Count the swaps each letter needs.'

/** A slug a shared link names that no problem in the archive goes by. */
const GONE_PROBLEM = 'gone-problem'

/** The search term the sender's list was narrowed by. */
const SEARCH_TERM = 'chameleon'

/**
 * The selector of the card a problem is drawn on.
 *
 * @param slug - The problem's slug.
 *
 * @returns The selector for its card.
 */
function cardOf(slug: string): string {
  // The card carrying the slug
  return `[${PROBLEM_CARD_ATTRIBUTE.name}="${slug}"]`
}

test.describe('problem solutions', () => {
  test('opens a problem’s solution from its card, the address naming it', async ({ page }) => {
    // One problem with a solution to read
    await stubSearchAnswer(
      page,
      searchAnswerWith({ [LISTED_PROBLEM]: { solutionMarkdown: LISTED_SOLUTION } })
    )

    // Open the library
    await page.goto(PROBLEMS_PATH)

    // The reader opens the solution from the problem's card
    const card = page.locator(cardOf(LISTED_PROBLEM))
    await card
      .getByRole('button', { name: problemsCopy.solution, exact: true })
      .click({ timeout: SETTLE_TIMEOUT_MS })

    // The solution, headed by the problem's slug in capitals
    const solution = page.getByRole('dialog', { name: problemsCopy.solution })
    await expect(solution).toContainText(LISTED_PROBLEM.toUpperCase())

    // Opens on its text
    await expect(solution).toContainText(LISTED_SOLUTION)

    // And the address names it, so a copied link opens it again
    await expect.poll(() => locationParam(page, URL_PARAMS.OPEN_SOLUTION)).toBe(LISTED_PROBLEM)
  })

  test('offers the solution of a problem with no tags to show', async ({ page }) => {
    // One problem with a solution and no tags
    await stubSearchAnswer(
      page,
      searchAnswerWith({ [LISTED_PROBLEM]: { solutionMarkdown: LISTED_SOLUTION, tags: [] } })
    )

    // Open the library
    await page.goto(PROBLEMS_PATH)

    // The problem's card offers its solution, with no tags beside it
    const card = page.locator(cardOf(LISTED_PROBLEM))
    await expect(
      card.getByRole('button', { name: problemsCopy.solution, exact: true })
    ).toBeVisible({ timeout: SETTLE_TIMEOUT_MS })
  })

  test('opens a shared solution of a problem past the loaded pages, over the sender’s search', async ({
    page,
  }) => {
    // Every notice the page raises, from the start
    const notices = await recordNotices(page)

    // A full first page of other problems, with more behind it
    const searches = await stubSearchRule(page, () => searchAnswerWithMoreToCome())

    // The shared problem, read on its own
    await stubSingleProblem(page, FAR_PROBLEM, { solutionMarkdown: FAR_SOLUTION })

    // Open the link the sender copied: their search, and the solution they had open
    await page.goto(
      `${PROBLEMS_PATH}?${URL_PARAMS.SEARCH_TEXT}=${SEARCH_TERM}&${URL_PARAMS.OPEN_SOLUTION}=${FAR_PROBLEM}`
    )

    // The solution opens
    const solution = page.getByRole('dialog', { name: problemsCopy.solution })
    await expect(solution).toContainText(FAR_SOLUTION, { timeout: SETTLE_TIMEOUT_MS })

    // Headed by the problem's slug in capitals
    await expect(solution).toContainText(FAR_PROBLEM.toUpperCase())

    // Though the list holds no card for its problem
    await expect(page.locator(cardOf(FAR_PROBLEM))).toHaveCount(0)

    // Over the sender's list
    await expect(page.locator(cardOf('filler-problem-1'))).toBeAttached()

    // Which the archive was asked for with the sender's search term
    expect(searches().map((query) => query.parameters.searchText)).toContain(SEARCH_TERM)

    // With nothing said about the address, such as part of it being ignored
    expect(notices()).toEqual([])
  })

  test('opens a shared solution whose link names the problem in capitals, as the page writes it', async ({
    page,
  }) => {
    // A full first page of other problems, with more behind it
    await stubSearchRule(page, () => searchAnswerWithMoreToCome())

    // The shared problem, read on its own
    await stubSingleProblem(page, FAR_PROBLEM, { solutionMarkdown: FAR_SOLUTION })

    // Open a link naming the problem the way the page writes its name
    await page.goto(`${PROBLEMS_PATH}?${URL_PARAMS.OPEN_SOLUTION}=${FAR_PROBLEM.toUpperCase()}`)

    // The solution opens
    const solution = page.getByRole('dialog', { name: problemsCopy.solution })
    await expect(solution).toContainText(FAR_SOLUTION, { timeout: SETTLE_TIMEOUT_MS })
  })

  test('says a shared solution’s problem is not there, and leaves the reader on the sender’s search', async ({
    page,
  }) => {
    // Every notice the page raises, from the start
    const notices = await recordNotices(page)

    // The sender's search, answered with a full first page of other problems
    await stubSearchRule(page, () => searchAnswerWithMoreToCome())

    // And no problem by the shared slug
    await stubMissingProblem(page, GONE_PROBLEM)

    // Open the link the sender copied: their search, and the solution they had open
    await page.goto(
      `${PROBLEMS_PATH}?${URL_PARAMS.SEARCH_TEXT}=${SEARCH_TERM}&${URL_PARAMS.OPEN_SOLUTION}=${GONE_PROBLEM}`
    )

    // The reader is told the problem is not there
    await expect
      .poll(() => notices(), { timeout: SETTLE_TIMEOUT_MS })
      .toContain(errorsCopy.problemNotFound.replace('{problemId}', GONE_PROBLEM))

    // The address names no solution
    await expect.poll(() => locationParam(page, URL_PARAMS.OPEN_SOLUTION)).toBeNull()

    // And keeps the sender's search
    expect(await locationParam(page, URL_PARAMS.SEARCH_TEXT)).toBe(SEARCH_TERM)

    // Whose list is on screen
    await expect(page.locator(cardOf('filler-problem-1'))).toBeAttached()
  })

  test('says a shared solution did not load, and opens it once another try gets through', async ({
    page,
  }) => {
    // A full first page of other problems, with more behind it
    await stubSearchRule(page, () => searchAnswerWithMoreToCome())

    // The shared problem, read on its own
    await stubSingleProblem(page, FAR_PROBLEM, { solutionMarkdown: FAR_SOLUTION })

    // The shared problem's read, failing until the server recovers
    const mendRead = await breakProblemRead(page, FAR_PROBLEM)

    // Open the link the sender copied
    await page.goto(`${PROBLEMS_PATH}?${URL_PARAMS.OPEN_SOLUTION}=${FAR_PROBLEM}`)

    // The reader is told the solution did not load
    const notice = page.getByText(errorsCopy.solutionLoadFailed)
    await expect(notice).toBeVisible({ timeout: SETTLE_TIMEOUT_MS })

    // The server recovers
    mendRead()

    // And the reader tries again
    await page.getByRole('button', { name: messages.ui.actions.retry }).click()

    // The solution opens
    const solution = page.getByRole('dialog', { name: problemsCopy.solution })
    await expect(solution).toContainText(FAR_SOLUTION, { timeout: SETTLE_TIMEOUT_MS })

    // And the notice is gone
    await expect(notice).toBeHidden()
  })

  test('closes the solution back to the list the reader was on', async ({ page }) => {
    // One problem with a solution to read
    await stubSearchAnswer(
      page,
      searchAnswerWith({ [LISTED_PROBLEM]: { solutionMarkdown: LISTED_SOLUTION } })
    )

    // Open the library narrowed by a search
    await page.goto(`${PROBLEMS_PATH}?${URL_PARAMS.SEARCH_TEXT}=${SEARCH_TERM}`)

    // The reader opens the problem's solution
    const card = page.locator(cardOf(LISTED_PROBLEM))
    await card
      .getByRole('button', { name: problemsCopy.solution, exact: true })
      .click({ timeout: SETTLE_TIMEOUT_MS })

    // The solution is open
    const solution = page.getByRole('dialog', { name: problemsCopy.solution })
    await expect(solution).toContainText(LISTED_SOLUTION)

    // The reader closes it again
    await solution.getByRole('button', { name: modalCopy.close }).click()

    // The solution is gone
    await expect(solution).toHaveCount(0)

    // The list is back, the card on it
    await expect(card).toBeVisible()

    // The address names no solution
    await expect.poll(() => locationParam(page, URL_PARAMS.OPEN_SOLUTION)).toBeNull()

    // And keeps the search
    expect(await locationParam(page, URL_PARAMS.SEARCH_TEXT)).toBe(SEARCH_TERM)
  })

  test('warns about an address it could not read only as the page opens, not as a solution opens over it', async ({
    page,
  }) => {
    // Every notice the page raises, from the start
    const notices = await recordNotices(page)

    // One problem with a solution to read
    await stubSearchAnswer(
      page,
      searchAnswerWith({ [LISTED_PROBLEM]: { solutionMarkdown: LISTED_SOLUTION } })
    )

    // Open a link carrying a key the archive does not know
    await page.goto(`${PROBLEMS_PATH}?bogus=1`)

    // A function which counts the times the reader has been told the address was not applied
    const warnings = () =>
      notices().filter((notice) => notice === errorsCopy.urlFiltersIgnored).length

    // The reader is warned as the page opens
    await expect.poll(warnings, { timeout: SETTLE_TIMEOUT_MS }).toBeGreaterThan(0)

    // Let the rest of the opening reach the screen
    await page.waitForTimeout(QUIET_MS)

    // How often the reader was warned by the time the page settled
    const warningsOnOpening = warnings()

    // The reader opens the problem's solution
    const card = page.locator(cardOf(LISTED_PROBLEM))
    await card
      .getByRole('button', { name: problemsCopy.solution, exact: true })
      .click({ timeout: SETTLE_TIMEOUT_MS })

    // The solution is open
    const solution = page.getByRole('dialog', { name: problemsCopy.solution })
    await expect(solution).toContainText(LISTED_SOLUTION)

    // The reader closes it again
    await solution.getByRole('button', { name: modalCopy.close }).click()

    // The solution is gone
    await expect(solution).toHaveCount(0)

    // Let anything the opening and the closing raised reach the screen
    await page.waitForTimeout(QUIET_MS)

    // Neither the opening nor the closing warned the reader again
    expect(warnings()).toBe(warningsOnOpening)
  })

  test('keeps a shared solution on the address when the favorites beside it are refused', async ({
    page,
  }) => {
    // One problem with a solution to read
    await stubSearchAnswer(
      page,
      searchAnswerWith({ [LISTED_PROBLEM]: { solutionMarkdown: LISTED_SOLUTION } })
    )

    // Open, signed out, the link a signed-in sender copied: their favorites, and the solution they had open
    await page.goto(
      `${PROBLEMS_PATH}?${URL_PARAMS.FAVORITES_ONLY}=true&${URL_PARAMS.OPEN_SOLUTION}=${LISTED_PROBLEM}`
    )

    // The favorites filter, which needs a signed-in reader, is gone from the address
    await expect
      .poll(() => locationParam(page, URL_PARAMS.FAVORITES_ONLY), { timeout: SETTLE_TIMEOUT_MS })
      .toBeNull()

    // The solution stays open
    const solution = page.getByRole('dialog', { name: problemsCopy.solution })
    await expect(solution).toContainText(LISTED_SOLUTION)

    // And the address still names it, so the reader can pass the link on
    await expect.poll(() => locationParam(page, URL_PARAMS.OPEN_SOLUTION)).toBe(LISTED_PROBLEM)
  })
})
