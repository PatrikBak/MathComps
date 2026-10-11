import type { Page } from '@playwright/test'

import {
  detailQuery,
  OPEN_PAPER_PARAM,
} from '@/components/features/problem-selection/model/selection-routes'
import type { Paper } from '@/components/features/problem-selection/model/selection-types'

import { SELECTION_PATH } from './support/competitions'
import {
  addressedParam,
  boardPanel,
  DRAFT_BOARD,
  FIRST,
  headingOf,
  ON_OFFER_COUNT,
  problemCount,
  READY,
  selectedTab,
  selectionCopy,
  selectionText,
  sendComment,
  SETTLE_TIMEOUT_MS,
  stubSelection,
  tabRowOn,
} from './support/problem-selection'
import { stubNamedReader } from './support/selection-comments'
import { expect, test } from './support/test'

/** The elementary paper of the board on screen: {@link FIRST} in E1, then two empty slots. */
const ELEMENTARY = DRAFT_BOARD.papers[0]

/** The intermediate paper of the board on screen, {@link READY} in I2. */
const INTERMEDIATE = DRAFT_BOARD.papers[1]

/** Where the elementary paper lives. */
const ELEMENTARY_ADDRESS = `${SELECTION_PATH}?${detailQuery({ kind: 'paper', id: ELEMENTARY.id, tab: undefined })}`

/** Where the elementary paper lives, on the tab its discussion is on. */
const ELEMENTARY_COMMENTS_ADDRESS = `${SELECTION_PATH}?${detailQuery({ kind: 'paper', id: ELEMENTARY.id, tab: 'comments' })}`

/** What a reviewer says about the elementary paper as a whole. */
const PAPER_COMMENT = 'E2 and E3 are both still empty, and E1 is the hardest of the three.'

/**
 * Slovak on the language switch in view.
 *
 * @param page - The page.
 *
 * @returns The option.
 */
function slovak(page: Page) {
  // The option on the one switch showing, the pool's being out of sight while a page is open
  return page
    .getByRole('radiogroup', { name: selectionCopy.language.label })
    .getByRole('radio', { name: 'sk', exact: true })
}

/**
 * A paper's heading, which only its own page shows.
 *
 * @param page - The page.
 * @param paper - The paper.
 *
 * @returns The heading.
 */
function paperHeading(page: Page, paper: Paper) {
  // The page's only second-level heading naming the paper
  return page.getByRole('heading', { level: 2, name: paper.name })
}

/**
 * The elementary paper's name on the board, which opens its page.
 *
 * @param page - The page.
 *
 * @returns The link.
 */
function elementaryLink(page: Page) {
  // The board's only link named after the paper
  return boardPanel(page).getByRole('link', { name: ELEMENTARY.name, exact: true })
}

test.describe("a paper's page", () => {
  test("opens on the paper's problems in their slots' order from the paper's name", async ({
    page,
  }) => {
    // A selection whose board on screen holds the elementary paper
    await stubSelection(page, 'selection')

    // The pool
    await page.goto(SELECTION_PATH)

    // The paper's name, followed
    await elementaryLink(page).click({ timeout: SETTLE_TIMEOUT_MS })

    // The paper's page, on its problems
    await expect(paperHeading(page, ELEMENTARY)).toBeVisible()
    await expect(selectedTab(page, selectionCopy.paper.tabsLabel)).toContainText(
      selectionCopy.paper.problemsTab
    )

    // The address naming the paper
    expect(await addressedParam(page, OPEN_PAPER_PARAM)).toBe(ELEMENTARY.id)

    // Every slot of the paper, in order
    const slots = page.getByRole('tabpanel').locator('ol').first().locator(':scope > li')

    // E1 holding its problem, the other two empty
    await expect(slots).toHaveCount(3)
    await expect(slots.nth(0)).toContainText(`E1#${FIRST.number} ${FIRST.title}`)
    await expect(slots.nth(1)).toHaveText(`E2${selectionCopy.board.empty}`)
    await expect(slots.nth(2)).toHaveText(`E3${selectionCopy.board.empty}`)
  })

  test("goes back to the pool by the left arrow, focus back on the paper's name", async ({
    page,
  }) => {
    // A selection whose board on screen holds the elementary paper
    await stubSelection(page, 'selection')

    // The pool
    await page.goto(SELECTION_PATH)

    // The paper's page, opened from its name
    await elementaryLink(page).click({ timeout: SETTLE_TIMEOUT_MS })

    // Focus on the paper's heading
    await expect(paperHeading(page, ELEMENTARY)).toBeFocused()

    // The left arrow
    await page.keyboard.press('ArrowLeft')

    // The pool back
    await expect(problemCount(page, ON_OFFER_COUNT)).toBeVisible()

    // The address naming no paper
    expect(await addressedParam(page, OPEN_PAPER_PARAM)).toBeNull()

    // Focus back on the paper's name
    await expect(elementaryLink(page)).toBeFocused()
  })

  test('takes a comment on its discussion, which the count on the board then opens', async ({
    page,
  }) => {
    // A reviewer with a username, which the discussion asks for before it takes a comment
    await stubNamedReader(page)

    // Whose selection's board on screen holds the elementary paper
    await stubSelection(page, 'selection')

    // The paper's discussion, opened from an address naming it
    await page.goto(ELEMENTARY_COMMENTS_ADDRESS)

    // The discussion's tab showing
    await expect(selectedTab(page, selectionCopy.paper.tabsLabel)).toContainText(
      selectionCopy.paper.commentsTab,
      {
        timeout: SETTLE_TIMEOUT_MS,
      }
    )

    // A comment, sent
    await sendComment(page.getByPlaceholder(selectionCopy.paper.placeholder), PAPER_COMMENT)

    // In the discussion
    await expect(page.getByRole('tabpanel')).toContainText(PAPER_COMMENT)

    // Back to the pool by the link on the paper's page
    await page.getByRole('link', { name: selectionCopy.detail.backToPool }).click()

    // The paper's count on the board
    const count = boardPanel(page).getByRole('link', {
      name: selectionText('board.paperComments', { paper: ELEMENTARY.name, count: 1 }),
    })

    // Followed
    await count.click()

    // The paper's discussion again, with the comment in it
    await expect(selectedTab(page, selectionCopy.paper.tabsLabel)).toContainText(
      selectionCopy.paper.commentsTab
    )
    await expect(page.getByRole('tabpanel')).toContainText(PAPER_COMMENT)
  })

  test('opens a problem from a row on the paper, then goes back to the paper where it was left', async ({
    page,
  }) => {
    // A selection whose board on screen holds the elementary paper
    await stubSelection(page, 'selection')

    // The paper's page
    await page.goto(ELEMENTARY_ADDRESS)

    // The problem in E1, on the paper
    const card = page.getByRole('tabpanel').getByRole('article')

    // Its comments row, under the whole statement
    const commentsRow = tabRowOn(card, 'comments', 0)

    // Brought into view
    await commentsRow.scrollIntoViewIfNeeded({ timeout: SETTLE_TIMEOUT_MS })

    // A function reading where the row stands in the view
    const rowTop = () => commentsRow.evaluate((row) => row.getBoundingClientRect().top)

    // Where the row stands now
    const leftAt = await rowTop()

    // Followed
    await commentsRow.click()

    // The problem's own page
    await expect(headingOf(page, FIRST)).toBeVisible()

    // Its conversations, picked
    await page.getByRole('tab', { name: selectionCopy.detail.conversationsTab }).click()

    // Named in the address
    await expect(page).toHaveURL(/[?&]tab=conversations/)

    // Its way back: the link named after the paper that answers to the left arrow, unlike the board's own link
    const wayBack = page
      .getByRole('link', { name: ELEMENTARY.name, exact: true })
      .and(page.locator('[aria-keyshortcuts="ArrowLeft"]'))

    // Followed
    await wayBack.click()

    // The paper's page again
    await expect(paperHeading(page, ELEMENTARY)).toBeVisible()

    // The row where it stood, give or take the pixel a scroll rounds to
    expect(Math.abs((await rowTop()) - leftAt)).toBeLessThan(2)

    // Focus on the problem's name
    await expect(card.getByRole('link', { name: FIRST.title })).toBeFocused()
  })

  test('keeps the language picked for it while one of its problems is open', async ({ page }) => {
    // A selection whose board on screen holds a problem written in every language in its intermediate paper
    await stubSelection(page, 'selection')

    // The intermediate paper's page
    await page.goto(
      `${SELECTION_PATH}?${detailQuery({ kind: 'paper', id: INTERMEDIATE.id, tab: undefined })}`
    )

    // Slovak, picked
    await slovak(page).click({ timeout: SETTLE_TIMEOUT_MS })

    // The problem in I2, opened from its name
    await page.getByRole('tabpanel').getByRole('link', { name: READY.title }).click()

    // Its page
    await expect(headingOf(page, READY)).toBeVisible()

    // Back to the paper by the left arrow
    await page.keyboard.press('ArrowLeft')

    // The paper again, still read in Slovak
    await expect(paperHeading(page, INTERMEDIATE)).toBeVisible()
    await expect(slovak(page)).toBeChecked()
  })
})
