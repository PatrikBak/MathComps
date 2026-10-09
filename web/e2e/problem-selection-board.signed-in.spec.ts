import type { Locator, Page } from '@playwright/test'

import { facetsCopy } from './support/archive-filters'
import { areaCopy, SELECTION_PATH } from './support/competitions'
import {
  ALGEBRA,
  BILINGUAL,
  boardPanel,
  cardOf,
  DRAFT_BOARD,
  FINALIZED_BOARD,
  FIRST,
  FULL_DRAFT,
  GEOMETRY,
  headingOf,
  LATER_DRAFT,
  ON_OFFER_COUNT,
  OPENED,
  openPool,
  pickBoard,
  placementOf,
  problemCount,
  READY,
  REVISION,
  selectionCopy,
  selectionText,
  SET_ASIDE,
  SETTLE_TIMEOUT_MS,
  slotOf,
  stubSelection,
  USED,
} from './support/problem-selection'
import { expect, test } from './support/test'

/** Any note saying which languages a round would refuse a slot's problem in, whichever languages it names. */
const MISSING_LANGUAGES_NOTE = new RegExp(
  selectionCopy.board.missingLanguages.replace('{languages}', '.+')
)

/** A phone's screen, narrow enough that the board folds into a bar above the pool. */
const PHONE_VIEWPORT = { width: 390, height: 844 }

/**
 * One of the pool's yes-or-no filters.
 *
 * @param page - The page.
 * @param name - What the pill says.
 *
 * @returns The pill.
 */
function pillOf(page: Page, name: string): Locator {
  // The only button saying it
  return page.getByRole('button', { name, exact: true })
}

/**
 * The address's query parameters as they stand.
 *
 * @param page - The page.
 *
 * @returns The parameters.
 */
function addressParams(page: Page): URLSearchParams {
  // Read off the address the page is on
  return new URL(page.url()).searchParams
}

/**
 * Picks one option of one of the pool's facets, and closes the facet again.
 *
 * @param page - The page.
 * @param facet - What the facet's pill says while nothing in it is picked.
 * @param option - The option's name, with the count it carries.
 */
async function pickFacetOption(page: Page, facet: string, option: string): Promise<void> {
  // The facet, opened
  await page.getByRole('button', { name: facet, exact: true }).click()

  // The option, picked
  await page.getByRole('checkbox', { name: option, exact: true }).check()

  // The facet, closed again
  await page.keyboard.press('Escape')
}

test.describe('the board being filled', () => {
  test('puts the first draft on screen ahead of a finalized board, paper by paper and slot by slot', async ({
    page,
  }) => {
    // A reviewer whose selection holds a finalized board and the drafts after it
    await stubSelection(page, 'selection')

    // The pool
    await openPool(page)

    // The first draft on screen, though a finalized board comes before it
    await expect(boardPanel(page).getByRole('button', { name: DRAFT_BOARD.name })).toBeVisible()

    // How full it is, across its papers
    await expect(boardPanel(page)).toContainText(
      selectionText('board.progress', { filled: 2, total: 9 })
    )

    // Its papers, in the order the board sets them out
    await expect(boardPanel(page).getByRole('heading', { level: 3 })).toHaveText([
      'Elementary',
      'Intermediate',
      'Advanced',
    ])

    // Every slot of every paper
    await expect(boardPanel(page).getByRole('listitem')).toHaveCount(9)

    // The ones holding nothing, saying so
    await expect(
      boardPanel(page).getByRole('listitem').filter({ hasText: selectionCopy.board.empty })
    ).toHaveCount(7)

    // The first elementary slot holding its problem
    await expect(slotOf(page, 'E1').getByRole('link', { name: FIRST.title })).toBeVisible()

    // And the second intermediate one its own
    await expect(slotOf(page, 'I2').getByRole('link', { name: READY.title })).toBeVisible()
  })

  test('switches to another board, naming which boards are drafts and which are finalized', async ({
    page,
  }) => {
    // A reviewer whose selection holds a finalized board and the drafts after it
    await stubSelection(page, 'selection')

    // The pool
    await openPool(page)

    // The menu of boards
    await boardPanel(page).getByRole('button', { name: DRAFT_BOARD.name }).click()

    // The board on screen, ticked
    await expect(page.getByRole('menuitemcheckbox', { name: DRAFT_BOARD.name })).toBeChecked()

    // The finalized board, called so
    await expect(page.getByRole('menuitemcheckbox', { name: FINALIZED_BOARD.name })).toContainText(
      selectionCopy.board.finalized
    )

    // The later draft, called a draft
    await expect(page.getByRole('menuitemcheckbox', { name: LATER_DRAFT.name })).toContainText(
      selectionCopy.board.draft
    )

    // The later draft, picked
    await page.getByRole('menuitemcheckbox', { name: LATER_DRAFT.name }).click()

    // On screen, with how full it is
    await expect(boardPanel(page)).toContainText(
      selectionText('board.progress', { filled: 3, total: 6 })
    )

    // Its paper outside the categories, among the others
    await expect(boardPanel(page).getByRole('heading', { level: 3 })).toHaveText([
      'Elementary',
      'Advanced',
      'Spare',
    ])

    // That paper's second slot holding the problem set aside
    await expect(slotOf(page, 'S2').getByRole('link', { name: SET_ASIDE.title })).toBeVisible()

    // The finalized board, picked in turn
    await pickBoard(page, LATER_DRAFT, FINALIZED_BOARD)

    // Holding the problem its round took
    await expect(slotOf(page, 'E1').getByRole('link', { name: USED.title })).toBeVisible()
  })

  test('keeps the board picked on screen when the selection is read again', async ({ page }) => {
    // The clock under the test's hand, so the next read comes when the test says
    await page.clock.install()

    // A reviewer whose selection holds a finalized board and the drafts after it
    const answerSelectionWith = await stubSelection(page, 'selection')

    // The pool
    await openPool(page)

    // The later draft, picked
    await pickBoard(page, DRAFT_BOARD, LATER_DRAFT)

    // A later read, which revises a problem
    answerSelectionWith('later')

    // Long enough for the selection to be read again
    await page.clock.fastForward('00:31')

    // Once the read has landed, which the revision on the problem's card shows
    await expect(cardOf(page, OPENED).getByText(REVISION)).toBeVisible({
      timeout: SETTLE_TIMEOUT_MS,
    })

    // The board picked still on screen, rather than the first draft
    await expect(boardPanel(page).getByRole('button', { name: LATER_DRAFT.name })).toBeVisible()
  })

  test('keeps the first draft on screen once another reviewer finalizes it, though nobody picked it', async ({
    page,
  }) => {
    // The clock under the test's hand, so the next read comes when the test says
    await page.clock.install()

    // A reviewer whose first draft is full and ready to be finalized
    const answerSelectionWith = await stubSelection(page, 'fullDraft')

    // The pool
    await openPool(page)

    // That draft on screen, being the first
    await expect(boardPanel(page).getByRole('button', { name: FULL_DRAFT.name })).toBeVisible()

    // A later read, by which another reviewer has finalized it
    answerSelectionWith('fullDraftFinalized')

    // Long enough for the selection to be read again
    await page.clock.fastForward('00:31')

    // Once the read has landed, which the problem its round took leaving the pool shows
    await expect(cardOf(page, READY)).toHaveCount(0, { timeout: SETTLE_TIMEOUT_MS })

    // The board still on screen, rather than the draft now first
    await expect(boardPanel(page).getByRole('button', { name: FULL_DRAFT.name })).toBeVisible()
  })

  test("opens a slot's problem in full, and marks a problem a round would refuse for its languages", async ({
    page,
  }) => {
    // A reviewer whose selection holds a finalized board and the drafts after it
    await stubSelection(page, 'selection')

    // The pool
    await openPool(page)

    // A problem written in English alone and solved in none, marked with every language a round would refuse
    await expect(slotOf(page, 'E1')).toContainText(
      selectionText('board.missingLanguages', { languages: 'SK, CS, EN' })
    )

    // A problem written and solved in every language, marked with none
    await expect(slotOf(page, 'I2')).not.toContainText(MISSING_LANGUAGES_NOTE)

    // The first problem, opened from its slot
    await slotOf(page, 'E1').getByRole('link', { name: FIRST.title }).click()

    // Its page
    await expect(headingOf(page, FIRST)).toBeVisible()

    // Named in the address
    expect(addressParams(page).get('problem')).toBe(FIRST.id)

    // The board still beside it
    await expect(boardPanel(page).getByRole('button', { name: DRAFT_BOARD.name })).toBeVisible()
  })

  test('folds the board into a bar on a phone, and folds it again once a slot opens its problem', async ({
    page,
  }) => {
    // A phone
    await page.setViewportSize(PHONE_VIEWPORT)

    // Whose reviewer's selection holds a finalized board and the drafts after it
    await stubSelection(page, 'selection')

    // The pool
    await openPool(page)

    // How full the board is, in the bar
    await expect(boardPanel(page)).toContainText(
      selectionText('board.progress', { filled: 2, total: 9 })
    )

    // Its papers folded away
    await expect(slotOf(page, 'E1')).toBeHidden()

    // Unfolded
    await page.getByRole('button', { name: selectionCopy.board.unfold }).click()

    // Its papers showing
    await expect(slotOf(page, 'E1')).toBeVisible()

    // The first problem, opened from its slot
    await slotOf(page, 'E1').getByRole('link', { name: FIRST.title }).click()

    // Its page, on screen rather than under the board
    await expect(headingOf(page, FIRST)).toBeInViewport()

    // The papers folded away again
    await expect(slotOf(page, 'E1')).toBeHidden()

    // With the way to unfold them back
    await expect(page.getByRole('button', { name: selectionCopy.board.unfold })).toBeVisible()
  })

  test('names on a problem every slot it fills, on whichever board', async ({ page }) => {
    // A reviewer whose selection holds a finalized board and the drafts after it
    await stubSelection(page, 'selection')

    // The pool
    await openPool(page)

    // A problem in a slot on the draft on screen, marked with it
    await expect(placementOf(cardOf(page, READY), DRAFT_BOARD, 'I2')).toBeVisible()

    // And with its slot on the later draft, which is not on screen
    await expect(placementOf(cardOf(page, READY), LATER_DRAFT, 'E1')).toBeVisible()

    // A problem in no slot, with no mark naming the board on screen
    await expect(cardOf(page, OPENED).getByText(DRAFT_BOARD.name, { exact: true })).toHaveCount(0)

    // A link to the problem a round took
    await page.goto(`${SELECTION_PATH}?problem=${USED.id}`)

    // Marked on its page with its slot on the finalized board
    await expect(placementOf(page.getByRole('article'), FINALIZED_BOARD, 'E1')).toBeVisible({
      timeout: SETTLE_TIMEOUT_MS,
    })
  })
})

test.describe('narrowing the pool', () => {
  test("searches problems' numbers, names and statements in every language, accents or none", async ({
    page,
  }) => {
    // A reviewer whose selection holds a pool of problems
    await stubSelection(page, 'selection')

    // The pool
    await openPool(page)

    // The search
    const search = page.getByRole('searchbox', { name: selectionCopy.pool.search })

    // A word of the bilingual problem's Slovak statement, typed without its accent
    await search.fill('zotieraju')

    // One problem alone
    await expect(page.getByRole('article')).toHaveCount(1)

    // Which is that one
    await expect(cardOf(page, BILINGUAL)).toBeVisible()

    // Counted
    await expect(problemCount(page, 1)).toBeVisible()

    // A problem's number
    await search.fill(`#${OPENED.number}`)

    // The problem quoted by it, alone
    await expect(page.getByRole('article')).toHaveCount(1)

    // Which is that one
    await expect(cardOf(page, OPENED)).toBeVisible()

    // A problem's working name
    await search.fill(ALGEBRA.title)

    // That problem, alone
    await expect(page.getByRole('article')).toHaveCount(1)

    // Which is that one
    await expect(cardOf(page, ALGEBRA)).toBeVisible()

    // Something no problem holds
    await search.fill('tessellation')

    // Said to be the search's doing, with problems there to find
    await expect(page.getByText(selectionCopy.pool.empty, { exact: true })).toBeVisible()
  })

  test("narrows by category and by area, each facet counting under the other's choice", async ({
    page,
  }) => {
    // A reviewer whose selection holds a pool of problems
    await stubSelection(page, 'selection')

    // The pool
    await openPool(page)

    // The category facet
    await page.getByRole('button', { name: selectionCopy.filters.category, exact: true }).click()

    // The one problem recommended for the elementary paper, counted
    await expect(
      page.getByRole('checkbox', { name: `${areaCopy.categories.elementary} (1)` })
    ).toBeVisible()

    // And the one for the advanced paper
    await expect(
      page.getByRole('checkbox', { name: `${areaCopy.categories.advanced} (1)` })
    ).toBeVisible()

    // The facet, closed again
    await page.keyboard.press('Escape')

    // The intermediate paper, picked
    await pickFacetOption(
      page,
      selectionCopy.filters.category,
      `${areaCopy.categories.intermediate} (6)`
    )

    // The problems recommended for it
    await expect(page.getByRole('article')).toHaveCount(6)

    // The one only for the advanced paper gone
    await expect(cardOf(page, GEOMETRY)).toHaveCount(0)

    // The area facet
    await page.getByRole('button', { name: selectionCopy.filters.area, exact: true }).click()

    // Geometry counted under the category picked, which leaves it nothing
    await expect(
      page.getByRole('checkbox', { name: `${selectionCopy.areas.geometry} (0)` })
    ).toBeVisible()

    // Algebra, counted with its one problem, picked
    await page.getByRole('checkbox', { name: `${selectionCopy.areas.algebra} (1)` }).check()

    // The facet, closed again
    await page.keyboard.press('Escape')

    // That problem alone
    await expect(page.getByRole('article')).toHaveCount(1)

    // Which is that one
    await expect(cardOf(page, ALGEBRA)).toBeVisible()
  })

  test('leaves out what the board on screen holds, following the board picked', async ({
    page,
  }) => {
    // A reviewer whose selection holds a finalized board and the drafts after it
    await stubSelection(page, 'selection')

    // The pool
    await openPool(page)

    // Only the problems the board on screen does not hold
    await pillOf(page, selectionCopy.filters.notSelected).click()

    // Pressed
    await expect(pillOf(page, selectionCopy.filters.notSelected)).toHaveAttribute(
      'aria-pressed',
      'true'
    )

    // Without the two the first draft holds
    await expect(page.getByRole('article')).toHaveCount(ON_OFFER_COUNT - 2)

    // One of them among those gone
    await expect(cardOf(page, FIRST)).toHaveCount(0)

    // The later draft, picked
    await pickBoard(page, DRAFT_BOARD, LATER_DRAFT)

    // Without the geometry problem it holds
    await expect(cardOf(page, GEOMETRY)).toHaveCount(0)

    // And with the problem only the first draft holds back
    await expect(cardOf(page, FIRST)).toBeVisible()

    // As many in all as before, each draft holding two of the pool's problems
    await expect(page.getByRole('article')).toHaveCount(ON_OFFER_COUNT - 2)
  })

  test('shows the set-aside problems in place of the live ones, dimmed and counted', async ({
    page,
  }) => {
    // A reviewer whose selection holds a pool of problems, one of them set aside
    await stubSelection(page, 'selection')

    // The pool
    await openPool(page)

    // The set-aside problems, counted on the way to them
    await pillOf(page, selectionText('filters.setAside', { count: 1 })).click()

    // In place of the live ones
    await expect(page.getByRole('article')).toHaveCount(1)

    // Which is the one set aside
    await expect(cardOf(page, SET_ASIDE)).toBeVisible()

    // Dimmed
    await expect(cardOf(page, SET_ASIDE)).toHaveCSS('opacity', '0.7')

    // Counted as set aside
    await expect(
      page.getByText(selectionText('pool.setAsideCount', { count: 1 }), { exact: true })
    ).toBeVisible()

    // A search none of them answers to
    await page.getByRole('searchbox', { name: selectionCopy.pool.search }).fill('tessellation')

    // Said to be the search's doing, among the set-aside problems
    await expect(
      page.getByText(selectionCopy.pool.emptySetAsideFiltered, { exact: true })
    ).toBeVisible()

    // Every filter, cleared
    await page.getByRole('button', { name: facetsCopy.clearFilters }).click()

    // The live problems again, every one of them
    await expect(page.getByRole('article')).toHaveCount(ON_OFFER_COUNT)

    // With nothing left to clear
    await expect(page.getByRole('button', { name: facetsCopy.clearFilters })).toHaveCount(0)
  })
})

test.describe('the filter in the address', () => {
  test('carries the search and the facets in the address, and comes back to them on a reload', async ({
    page,
  }) => {
    // A reviewer whose selection holds a pool of problems
    await stubSelection(page, 'selection')

    // The pool
    await openPool(page)

    // Searched
    await page.getByRole('searchbox', { name: selectionCopy.pool.search }).fill('game')

    // Narrowed to the intermediate paper
    await pickFacetOption(
      page,
      selectionCopy.filters.category,
      `${areaCopy.categories.intermediate} (6)`
    )

    // The intermediate problems
    await expect(page.getByRole('article')).toHaveCount(6)

    // The search and the category in the address, under the names links already shared carry
    await expect.poll(() => addressParams(page).toString()).toBe('q=game&category=intermediate')

    // Reloaded
    await page.reload()

    // The same problems
    await expect(page.getByRole('article')).toHaveCount(6, { timeout: SETTLE_TIMEOUT_MS })

    // And the search as it was typed
    await expect(page.getByRole('searchbox', { name: selectionCopy.pool.search })).toHaveValue(
      'game'
    )
  })

  test('leaves "Not selected" out of the address, keeping it through a step back but not a reload', async ({
    page,
  }) => {
    // A reviewer whose selection holds a finalized board and the drafts after it
    await stubSelection(page, 'selection')

    // The pool
    await openPool(page)

    // Narrowed to what the board on screen does not hold
    await pillOf(page, selectionCopy.filters.notSelected).click()

    // A problem, opened
    await cardOf(page, OPENED).getByRole('link', { name: OPENED.title }).click()

    // Named alone in the address, "Not selected" nowhere in it
    await expect.poll(() => addressParams(page).toString()).toBe(`problem=${OPENED.id}`)

    // Back
    await page.goBack()

    // The pool, still leaving out what the first draft holds
    await expect(page.getByRole('article')).toHaveCount(ON_OFFER_COUNT - 2)

    // With "Not selected" still pressed
    await expect(pillOf(page, selectionCopy.filters.notSelected)).toHaveAttribute(
      'aria-pressed',
      'true'
    )

    // Reloaded
    await page.reload()

    // Every live problem again
    await expect(page.getByRole('article')).toHaveCount(ON_OFFER_COUNT, {
      timeout: SETTLE_TIMEOUT_MS,
    })

    // "Not selected" let go
    await expect(pillOf(page, selectionCopy.filters.notSelected)).toHaveAttribute(
      'aria-pressed',
      'false'
    )
  })

  test('keeps the filter in the address while a problem is open, and brings the pool back narrowed', async ({
    page,
  }) => {
    // A reviewer whose selection holds a pool of problems
    await stubSelection(page, 'selection')

    // A link to the pool narrowed to algebra
    await page.goto(`${SELECTION_PATH}?area=algebra`)

    // The one algebra problem
    await expect(page.getByRole('article')).toHaveCount(1, { timeout: SETTLE_TIMEOUT_MS })

    // Opened
    await cardOf(page, ALGEBRA).getByRole('link', { name: ALGEBRA.title }).click()

    // Its page
    await expect(headingOf(page, ALGEBRA)).toBeVisible()

    // Named in the address beside the filter
    await expect
      .poll(() => addressParams(page).toString())
      .toBe(`area=algebra&problem=${ALGEBRA.id}`)

    // Its comments, opened
    await page.getByRole('tab', { name: selectionCopy.detail.commentsTab }).click()

    // Named in the address too, the filter still beside them
    await expect
      .poll(() => addressParams(page).toString())
      .toBe(`area=algebra&problem=${ALGEBRA.id}&tab=comments`)

    // Back to the pool by the link on the problem's page
    await page.getByRole('link', { name: selectionCopy.detail.backToPool }).click()

    // Under the filter alone
    await expect.poll(() => addressParams(page).toString()).toBe('area=algebra')

    // Still narrowed by it
    await expect(page.getByRole('article')).toHaveCount(1)
  })

  test('steps back through history to the filter each step held, with a problem open over the pool too', async ({
    page,
  }) => {
    // A reviewer whose selection holds a pool of problems
    await stubSelection(page, 'selection')

    // The pool
    await openPool(page)

    // Narrowed to the intermediate paper
    await pickFacetOption(
      page,
      selectionCopy.filters.category,
      `${areaCopy.categories.intermediate} (6)`
    )

    // A problem, opened
    await cardOf(page, OPENED).getByRole('link', { name: OPENED.title }).click()

    // Its page
    await expect(headingOf(page, OPENED)).toBeVisible()

    // Back to the pool by the link on the problem's page
    await page.getByRole('link', { name: selectionCopy.detail.backToPool }).click()

    // Every filter, cleared
    await page.getByRole('button', { name: facetsCopy.clearFilters }).click()

    // Every live problem
    await expect(page.getByRole('article')).toHaveCount(ON_OFFER_COUNT)

    // Back
    await page.goBack()

    // Onto the problem, under the filter as it stood when the problem was opened
    await expect
      .poll(() => addressParams(page).toString())
      .toBe(`category=intermediate&problem=${OPENED.id}`)

    // Back again
    await page.goBack()

    // Onto the pool as it was narrowed
    await expect.poll(() => addressParams(page).toString()).toBe('category=intermediate')

    // Showing the intermediate problems again
    await expect(page.getByRole('article')).toHaveCount(6)

    // Without the one only for the advanced paper
    await expect(cardOf(page, GEOMETRY)).toHaveCount(0)
  })
})
