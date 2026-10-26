import type { Locator } from '@playwright/test'

import { URL_PARAMS } from '@/components/features/problems/utils/search-url-serialization'
import { FACET_ROW_ATTRIBUTE } from '@/components/shared/components/facets/hooks/use-facet-row-navigation'

import { facetsCopy, filtersCopy, SHORT_WINDOW, TALL_WINDOW } from './support/archive-filters'
import { PROBLEMS_PATH, stubProblemSearch } from './support/backend-routes'
import {
  focusedRowId,
  headingResetOf,
  openFacet,
  panelResetOf,
  QUIET_MS,
  rowTabStops,
  urlParam,
} from './support/facets'
import { expect, test } from './support/test'

/** The title of the facet listing competitions, a tree whose every branch starts open. */
const COMPETITION = filtersCopy.facets.competition

/** How long the library needs to read the URL and send the one search off the back of it. */
const SETTLE_TIMEOUT_MS = 15_000

/** How long the pointer is held down for a long press, with room to spare over what counts as one. */
const LONG_PRESS_MS = 800

/** The competition the fixture's one problem comes from. */
const FOUND_COMPETITION = 'tst-d3'

/** A search only that competition's name carries. */
const FOUND_COMPETITION_SEARCH = 'Day 3'

/**
 * One node's row in an open tree facet.
 *
 * @param panel - The open panel.
 * @param id - The node's id.
 *
 * @returns The row, which a click anywhere but its arrow picks the node from.
 */
function rowOf(panel: Locator, id: string): Locator {
  // Marked with the node it stands for
  return panel.locator(`[${FACET_ROW_ATTRIBUTE.name}="${id}"]`)
}

/**
 * The arrow on a branch's row, which opens and closes the branch without picking it.
 *
 * @param panel - The open panel.
 * @param id - The branch's id.
 *
 * @returns The arrow.
 */
function chevronOf(panel: Locator, id: string): Locator {
  // The one icon the row draws
  return rowOf(panel, id).locator('svg')
}

/**
 * Every row an open tree facet draws.
 *
 * @param panel - The open panel.
 *
 * @returns The rows, one per node on show.
 */
function rowsOf(panel: Locator): Locator {
  // Each node is read out as an item of the tree
  return panel.getByRole('treeitem')
}

test.beforeEach(async ({ page }) => {
  // Every search answered with one and the same page of the archive, which offers every facet its options
  await stubProblemSearch(page, () => null)

  // The archive, with nothing picked yet
  await page.goto(PROBLEMS_PATH)
})

test.describe('opening and closing a branch of a tree facet', () => {
  test('opens and closes a branch from its arrow, picking nothing', async ({ page }) => {
    // The facet, opened
    const panel = await openFacet(page, COMPETITION)

    // The MEMO branch, and one of the rounds under it
    const memo = rowOf(panel, 'memo')
    const individual = rowOf(panel, 'memo-i')

    // Open to begin with
    await expect(memo).toHaveAttribute('aria-expanded', 'true')
    await expect(individual).toBeVisible()

    // The arrow, clicked
    await chevronOf(panel, 'memo').click()

    // Closes the branch
    await expect(memo).toHaveAttribute('aria-expanded', 'false')
    await expect(individual).toHaveCount(0)

    // Without picking it
    await expect(memo).toHaveAttribute('aria-checked', 'false')

    // The arrow, clicked again
    await chevronOf(panel, 'memo').click()

    // Opens it again
    await expect(memo).toHaveAttribute('aria-expanded', 'true')
    await expect(individual).toBeVisible()

    // Given time for a pick the clicks might have made to reach the address
    await page.waitForTimeout(QUIET_MS)

    // And nothing was picked along the way
    expect(urlParam(page, URL_PARAMS.COMPETITIONS)()).toBeNull()
    await expect(memo).toHaveAttribute('aria-checked', 'false')
  })

  test('closes a branch with Left, opens it with Right and steps into it once open, the walk skipping what is closed', async ({
    page,
  }) => {
    // The facet, opened on its search box
    const panel = await openFacet(page, COMPETITION)

    // Down
    await page.keyboard.press('ArrowDown')

    // Into the tree at its top, the CSMO branch
    await expect.poll(() => focusedRowId(page)).toBe('csmo')

    // Right, on a branch already open
    await page.keyboard.press('ArrowRight')

    // Onto its first category, the branch left open
    await expect.poll(() => focusedRowId(page)).toBe('csmo-a')
    await expect(rowOf(panel, 'csmo')).toHaveAttribute('aria-expanded', 'true')

    // Back up
    await page.keyboard.press('ArrowUp')

    // On CSMO
    await expect.poll(() => focusedRowId(page)).toBe('csmo')

    // Left
    await page.keyboard.press('ArrowLeft')

    // Closes it
    await expect(rowOf(panel, 'csmo')).toHaveAttribute('aria-expanded', 'false')

    // Left again, on a branch already closed
    await page.keyboard.press('ArrowLeft')

    // Leaves it closed
    await expect(rowOf(panel, 'csmo')).toHaveAttribute('aria-expanded', 'false')

    // Down
    await page.keyboard.press('ArrowDown')

    // Straight on to the next competition, past the categories now hidden
    await expect.poll(() => focusedRowId(page)).toBe('tst')

    // Back up
    await page.keyboard.press('ArrowUp')

    // On CSMO again
    await expect.poll(() => focusedRowId(page)).toBe('csmo')

    // Right, on the branch now closed
    await page.keyboard.press('ArrowRight')

    // Opens it
    await expect(rowOf(panel, 'csmo')).toHaveAttribute('aria-expanded', 'true')

    // Down
    await page.keyboard.press('ArrowDown')

    // Into its first category
    await expect.poll(() => focusedRowId(page)).toBe('csmo-a')
  })

  test('climbs to the branch above with Left from a row with nothing open beneath it', async ({
    page,
  }) => {
    // The facet, opened
    const panel = await openFacet(page, COMPETITION)

    // Down three times, from the search box through CSMO and its category A onto the category's first round
    await page.keyboard.press('ArrowDown')
    await page.keyboard.press('ArrowDown')
    await page.keyboard.press('ArrowDown')

    // On the round
    await expect.poll(() => focusedRowId(page)).toBe('csmo-a-i')

    // Left
    await page.keyboard.press('ArrowLeft')

    // Up on the category holding the round, which stays open
    await expect.poll(() => focusedRowId(page)).toBe('csmo-a')
    await expect(rowOf(panel, 'csmo-a')).toHaveAttribute('aria-expanded', 'true')

    // Left again
    await page.keyboard.press('ArrowLeft')

    // Closes the category
    await expect(rowOf(panel, 'csmo-a')).toHaveAttribute('aria-expanded', 'false')

    // And once more, from the category now closed
    await page.keyboard.press('ArrowLeft')

    // Up on CSMO
    await expect.poll(() => focusedRowId(page)).toBe('csmo')
  })
})

test.describe('picking in a tree facet', () => {
  test('shows every branch above a picked node as part-picked', async ({ page }) => {
    // The facet, opened
    const panel = await openFacet(page, COMPETITION)

    // One round of category A, picked
    await rowOf(panel, 'csmo-a-i').click()

    // In the address
    await expect.poll(urlParam(page, URL_PARAMS.COMPETITIONS)).toBe('csmo-a-i')

    // The round itself picked
    await expect(rowOf(panel, 'csmo-a-i')).toHaveAttribute('aria-checked', 'true')

    // And both branches above it part-picked, read out that way
    await expect(rowOf(panel, 'csmo-a')).toHaveAttribute('aria-checked', 'mixed')
    await expect(rowOf(panel, 'csmo')).toHaveAttribute('aria-checked', 'mixed')

    // A function reading whether category A's checkbox is drawn part-picked
    const isCategoryDrawnPartPicked = () =>
      rowOf(panel, 'csmo-a')
        .locator('input')
        .evaluate((checkbox: HTMLInputElement) => checkbox.indeterminate)

    // And drawn that way
    expect(await isCategoryDrawnPartPicked()).toBe(true)

    // The round, unpicked again
    await rowOf(panel, 'csmo-a-i').click()

    // Out of the address
    await expect.poll(urlParam(page, URL_PARAMS.COMPETITIONS)).toBeNull()

    // And category A drawn picked by nothing any more
    await expect(rowOf(panel, 'csmo-a')).toHaveAttribute('aria-checked', 'false')
    expect(await isCategoryDrawnPartPicked()).toBe(false)
  })

  test('leaves a closed branch closed as it is picked or narrowed to, so no row moves', async ({
    page,
  }) => {
    // The facet, opened
    const panel = await openFacet(page, COMPETITION)

    // The MEMO branch
    const memo = rowOf(panel, 'memo')

    // Closed by its arrow
    await chevronOf(panel, 'memo').click()

    // Closed
    await expect(memo).toHaveAttribute('aria-expanded', 'false')

    // How many rows the tree draws with MEMO closed
    const drawnCount = await rowsOf(panel).count()

    // The branch, picked
    await memo.click()

    // In the address
    await expect.poll(urlParam(page, URL_PARAMS.COMPETITIONS)).toBe('memo')

    // Picked, and still closed, every row where it was
    await expect(memo).toHaveAttribute('aria-checked', 'true')
    await expect(memo).toHaveAttribute('aria-expanded', 'false')
    await expect(rowsOf(panel)).toHaveCount(drawnCount)

    // The TST branch, picked beside it
    await rowOf(panel, 'tst').click()

    // Picked
    await expect(rowOf(panel, 'tst')).toHaveAttribute('aria-checked', 'true')

    // MEMO, narrowed to with the modifier held
    await memo.click({ modifiers: ['ControlOrMeta'] })

    // Standing alone in the address, TST dropped from it
    await expect.poll(urlParam(page, URL_PARAMS.COMPETITIONS)).toBe('memo')
    await expect(rowOf(panel, 'tst')).toHaveAttribute('aria-checked', 'false')

    // And still closed
    await expect(memo).toHaveAttribute('aria-expanded', 'false')
    await expect(rowsOf(panel)).toHaveCount(drawnCount)
  })

  test('narrows to the node a long press lands on, and keeps it', async ({ page }) => {
    // The facet, opened
    const panel = await openFacet(page, COMPETITION)

    // A round of MEMO picked the ordinary way, which a long press elsewhere has to drop
    await rowOf(panel, 'memo-i').click()

    // Picked
    await expect(rowOf(panel, 'memo-i')).toHaveAttribute('aria-checked', 'true')

    // The row of the competition the fixture's one problem comes from
    const foundRow = rowOf(panel, FOUND_COMPETITION)

    // Settled on the archive's answer, so the row holds still under the pointer
    await expect(foundRow).toHaveAttribute('aria-label', /\(1\)$/, { timeout: SETTLE_TIMEOUT_MS })

    // Scrolled into the list's view, since the pointer has to land on it
    await foundRow.scrollIntoViewIfNeeded()

    // The row's box on screen
    const box = (await foundRow.boundingBox())!

    // The pointer on it
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2)

    // Pressed down
    await page.mouse.down()

    // And held long enough to count as a long press
    await page.waitForTimeout(LONG_PRESS_MS)

    // And let go, which sends a click of its own
    await page.mouse.up()

    // A function reading the competitions picked off the address
    const picked = urlParam(page, URL_PARAMS.COMPETITIONS)

    // The facet narrowed to the competition
    await expect.poll(picked, { timeout: SETTLE_TIMEOUT_MS }).toBe(FOUND_COMPETITION)

    // Given time for the click to land
    await page.waitForTimeout(QUIET_MS)

    // And the click after the press left it so
    expect(picked()).toBe(FOUND_COMPETITION)
    expect(await foundRow.getAttribute('aria-checked')).toBe('true')
    expect(await rowOf(panel, 'memo-i').getAttribute('aria-checked')).toBe('false')
  })
})

test.describe('reopening a tree facet', () => {
  test('opens scrolled to the first node picked, wherever the tree draws it', async ({ page }) => {
    // The facet, opened
    let panel = await openFacet(page, COMPETITION)

    // The node drawn last, well below what the panel shows at once
    const lastId = (await rowsOf(panel).last().getAttribute(FACET_ROW_ATTRIBUTE.name))!

    // Picked
    await rowOf(panel, lastId).click()

    // In the address
    await expect.poll(urlParam(page, URL_PARAMS.COMPETITIONS)).toBe(lastId)

    // The facet, closed
    await page.keyboard.press('Escape')

    // And opened again
    panel = await openFacet(page, COMPETITION)

    // On show, the list scrolled down to it
    await expect(rowOf(panel, lastId)).toBeInViewport()
  })
})

test.describe('searching a tree facet', () => {
  test('narrows the tree to the search, opening what sits above a match, and says so when nothing matches', async ({
    page,
  }) => {
    // The facet, opened
    const panel = await openFacet(page, COMPETITION)

    // The TST branch, closed by the reader
    await chevronOf(panel, 'tst').click()

    // Closed
    await expect(rowOf(panel, 'tst')).toHaveAttribute('aria-expanded', 'false')

    // A search only one of its days carries
    await panel.getByRole('textbox').fill(FOUND_COMPETITION_SEARCH)

    // That day alone, with the competition it sits in
    await expect(rowsOf(panel)).toHaveCount(2)
    await expect(rowOf(panel, FOUND_COMPETITION)).toBeVisible()

    // Whose branch opens to show it
    await expect(rowOf(panel, 'tst')).toHaveAttribute('aria-expanded', 'true')

    // A search matching nothing
    await panel.getByRole('textbox').fill('no such competition')

    // Said to match nothing
    await expect(panel.getByText(facetsCopy.noResults, { exact: true })).toBeVisible()
    await expect(rowsOf(panel)).toHaveCount(0)
  })

  test('reads a branch as part-picked for a pick the search leaves off the screen', async ({
    page,
  }) => {
    // The facet, opened
    const panel = await openFacet(page, COMPETITION)

    // A day of TST, picked
    await rowOf(panel, 'tst-d1').click()

    // In the address
    await expect.poll(urlParam(page, URL_PARAMS.COMPETITIONS)).toBe('tst-d1')

    // A search reaching another of its days
    await panel.getByRole('textbox').fill(FOUND_COMPETITION_SEARCH)

    // That day alone on show beneath TST
    await expect(rowsOf(panel)).toHaveCount(2)

    // TST read as part-picked all the same, for the day the search hides
    await expect(rowOf(panel, 'tst')).toHaveAttribute('aria-checked', 'mixed')
  })

  test('reads a search of nothing but spaces as no search, so a branch opened under one stays open', async ({
    page,
  }) => {
    // The facet, opened
    const panel = await openFacet(page, COMPETITION)

    // The TST branch
    const tst = rowOf(panel, 'tst')

    // Closed by its arrow
    await chevronOf(panel, 'tst').click()

    // Closed
    await expect(tst).toHaveAttribute('aria-expanded', 'false')

    // The search box, holding a space alone
    await panel.getByRole('textbox').fill(' ')

    // The arrow, clicked again
    await chevronOf(panel, 'tst').click()

    // Opens the branch
    await expect(tst).toHaveAttribute('aria-expanded', 'true')

    // The space, deleted
    await panel.getByRole('textbox').fill('')

    // The branch stays open, the reader's own tree having been the one to move
    await expect(tst).toHaveAttribute('aria-expanded', 'true')
  })

  test('closes a branch under a search from its arrow, and opens and closes it with Right and Left', async ({
    page,
  }) => {
    // The facet, opened
    const panel = await openFacet(page, COMPETITION)

    // The TST branch
    const tst = rowOf(panel, 'tst')

    // A search only one of its days carries
    await panel.getByRole('textbox').fill(FOUND_COMPETITION_SEARCH)

    // Which narrows the tree to the branch and the one day it holds, the branch open to show it
    await expect(rowsOf(panel)).toHaveCount(2)
    await expect(tst).toHaveAttribute('aria-expanded', 'true')

    // The arrow, clicked
    await chevronOf(panel, 'tst').click()

    // Closes the branch, the day it holds with it
    await expect(tst).toHaveAttribute('aria-expanded', 'false')
    await expect(rowOf(panel, FOUND_COMPETITION)).toHaveCount(0)

    // Focus on the branch
    await tst.focus()

    // Right
    await page.keyboard.press('ArrowRight')

    // Opens it again
    await expect(tst).toHaveAttribute('aria-expanded', 'true')
    await expect(rowOf(panel, FOUND_COMPETITION)).toBeVisible()

    // Left
    await page.keyboard.press('ArrowLeft')

    // Closes it again
    await expect(tst).toHaveAttribute('aria-expanded', 'false')
  })

  test("lets a close made under a search last as long as its term, handing back the reader's own tree after", async ({
    page,
  }) => {
    // The facet, opened
    const panel = await openFacet(page, COMPETITION)

    // The search box
    const search = panel.getByRole('textbox')

    // The TST branch
    const tst = rowOf(panel, 'tst')

    // A search only one of its days carries
    await search.fill(FOUND_COMPETITION_SEARCH)

    // Which narrows the tree to the branch and the one day it holds
    await expect(rowsOf(panel)).toHaveCount(2)

    // The branch, closed by its arrow
    await chevronOf(panel, 'tst').click()

    // Closed
    await expect(tst).toHaveAttribute('aria-expanded', 'false')

    // The term, changed to one every day carries
    await search.fill('Day')

    // Opens the branch afresh, to show what the new term found in it
    await expect(tst).toHaveAttribute('aria-expanded', 'true')

    // Closed by its arrow once more
    await chevronOf(panel, 'tst').click()

    // Closed
    await expect(tst).toHaveAttribute('aria-expanded', 'false')

    // The search, emptied
    await search.fill('')

    // The branch back the way the reader had it before searching, open as every branch starts
    await expect(tst).toHaveAttribute('aria-expanded', 'true')
  })

  test('keeps the branch above a branch picked under a search open once the search is emptied, the branch itself as the reader left it', async ({
    page,
  }) => {
    // The facet, opened
    const panel = await openFacet(page, COMPETITION)

    // The CSMO branch
    const csmo = rowOf(panel, 'csmo')

    // Category A, closed by its arrow while it is still on show
    await chevronOf(panel, 'csmo-a').click()

    // And CSMO above it, both closed by the reader before searching
    await chevronOf(panel, 'csmo').click()

    // Closed
    await expect(csmo).toHaveAttribute('aria-expanded', 'false')

    // The search box
    const search = panel.getByRole('textbox')

    // A search for the category by its name, which opens CSMO to show it
    await search.fill('Category A')

    // The category on show beneath it
    await expect(rowsOf(panel)).toHaveCount(2)

    // Category A
    const categoryA = rowOf(panel, 'csmo-a')

    // Picked whole
    await categoryA.click()

    // In the address
    await expect.poll(urlParam(page, URL_PARAMS.COMPETITIONS)).toBe('csmo-a')

    // The search, emptied
    await search.fill('')

    // CSMO stays open, keeping the category in view, while the category stays closed the way the reader left it
    await expect(csmo).toHaveAttribute('aria-expanded', 'true')
    await expect(categoryA).toHaveAttribute('aria-expanded', 'false')
    await expect(rowOf(panel, 'csmo-a-i')).toHaveCount(0)
  })

  test('keeps a day picked under a search in view once the search is emptied, the branch above it open', async ({
    page,
  }) => {
    // The facet, opened
    const panel = await openFacet(page, COMPETITION)

    // The TST branch
    const tst = rowOf(panel, 'tst')

    // Closed by the reader before searching
    await chevronOf(panel, 'tst').click()

    // Closed
    await expect(tst).toHaveAttribute('aria-expanded', 'false')

    // The search box
    const search = panel.getByRole('textbox')

    // A search reaching one of its days, which opens it
    await search.fill(FOUND_COMPETITION_SEARCH)

    // The day, picked
    await rowOf(panel, FOUND_COMPETITION).click()

    // In the address
    await expect.poll(urlParam(page, URL_PARAMS.COMPETITIONS)).toBe(FOUND_COMPETITION)

    // The search, emptied
    await search.fill('')

    // TST stays open, the day picked on show beneath it
    await expect(tst).toHaveAttribute('aria-expanded', 'true')
    await expect(rowOf(panel, FOUND_COMPETITION)).toBeVisible()
  })

  test('leaves the caret in the search box when a row is picked, so the search goes on being typed', async ({
    page,
  }) => {
    // The facet, opened
    const panel = await openFacet(page, COMPETITION)

    // Half a search typed
    await page.keyboard.type('Day')

    // A day it finds, picked
    await rowOf(panel, 'tst-d1').click()

    // In the address
    await expect.poll(urlParam(page, URL_PARAMS.COMPETITIONS)).toBe('tst-d1')

    // The rest of the search typed straight on
    await page.keyboard.type(' 3')

    // Into the box it started in
    await expect(panel.getByRole('textbox')).toHaveValue(FOUND_COMPETITION_SEARCH)
  })

  test('hands back the branches as the reader left them once the search is emptied', async ({
    page,
  }) => {
    // The facet, opened
    const panel = await openFacet(page, COMPETITION)

    // The TST branch, closed by the reader
    await chevronOf(panel, 'tst').click()

    // Closed
    await expect(rowOf(panel, 'tst')).toHaveAttribute('aria-expanded', 'false')

    // A search that reaches under it
    await panel.getByRole('textbox').fill(FOUND_COMPETITION_SEARCH)

    // Opens it
    await expect(rowOf(panel, 'tst')).toHaveAttribute('aria-expanded', 'true')

    // The search, emptied
    await panel.getByRole('textbox').fill('')

    // The branch goes back to closed, the way the reader left it
    await expect(rowOf(panel, 'tst')).toHaveAttribute('aria-expanded', 'false')
    await expect(rowOf(panel, FOUND_COMPETITION)).toHaveCount(0)

    // While the one they never touched stays open
    await expect(rowOf(panel, 'csmo')).toHaveAttribute('aria-expanded', 'true')
  })
})

test.describe('a tree facet from the keyboard', () => {
  test('hands focus to the row a click lands on while focus sits on another, so the keys go on from it', async ({
    page,
  }) => {
    // The facet, opened
    const panel = await openFacet(page, COMPETITION)

    // Down, into the tree at its top
    await page.keyboard.press('ArrowDown')

    // On CSMO
    await expect.poll(() => focusedRowId(page)).toBe('csmo')

    // MEMO, clicked
    await rowOf(panel, 'memo').click()

    // A function reading the competitions picked off the address
    const picked = urlParam(page, URL_PARAMS.COMPETITIONS)

    // MEMO picked
    await expect.poll(picked).toBe('memo')

    // With focus come along to it
    await expect.poll(() => focusedRowId(page)).toBe('memo')

    // Space
    await page.keyboard.press('Space')

    // Unpicks the row clicked, rather than the one the arrows had reached
    await expect.poll(picked).toBeNull()
  })

  test('picks the focused node with Space or Enter, and narrows to it with the modifier held', async ({
    page,
  }) => {
    // The facet, opened
    const panel = await openFacet(page, COMPETITION)

    // Focus on a round of MEMO
    await rowOf(panel, 'memo-i').focus()

    // Space
    await page.keyboard.press('Space')

    // A function reading the competitions picked off the address
    const picked = urlParam(page, URL_PARAMS.COMPETITIONS)

    // Picks it
    await expect.poll(picked).toBe('memo-i')

    // Focus on a day of TST
    await rowOf(panel, 'tst-d1').focus()

    // Enter
    await page.keyboard.press('Enter')

    // Picks it alongside the round
    await expect(rowOf(panel, 'tst-d1')).toHaveAttribute('aria-checked', 'true')
    await expect(rowOf(panel, 'memo-i')).toHaveAttribute('aria-checked', 'true')

    // Focus on category A
    await rowOf(panel, 'csmo-a').focus()

    // Space, with the modifier held
    await page.keyboard.press('ControlOrMeta+Space')

    // The facet narrows to it, the way a modified click on it does
    await expect.poll(picked).toBe('csmo-a')
  })

  test('hands focus to a branch whose arrow closes away the row focus was on', async ({ page }) => {
    // The facet, opened
    const panel = await openFacet(page, COMPETITION)

    // A round of MEMO picked, which takes the tab stop once no row holds focus
    await rowOf(panel, 'memo-i').click()

    // In the address
    await expect.poll(urlParam(page, URL_PARAMS.COMPETITIONS)).toBe('memo-i')

    // Down twice, from the search box past CSMO onto its first category
    await page.keyboard.press('ArrowDown')
    await page.keyboard.press('ArrowDown')

    // On the category
    await expect.poll(() => focusedRowId(page)).toBe('csmo-a')

    // CSMO, closed by its arrow
    await chevronOf(panel, 'csmo').click()

    // Closed, focus on the branch that closed
    await expect(rowOf(panel, 'csmo')).toHaveAttribute('aria-expanded', 'false')
    await expect(rowOf(panel, 'csmo')).toBeFocused()
  })

  test('picks a node once while Space is held down', async ({ page }) => {
    // The facet, opened
    const panel = await openFacet(page, COMPETITION)

    // Focus on a round of MEMO
    await rowOf(panel, 'memo-i').focus()

    // Space pressed
    await page.keyboard.down('Space')

    // And again while held, the way a keyboard repeats it
    await page.keyboard.down('Space')

    // And let go
    await page.keyboard.up('Space')

    // Picked once, the repeat taking nothing back
    await expect(rowOf(panel, 'memo-i')).toHaveAttribute('aria-checked', 'true')

    // Given time for every pick the keys made to reach the address
    await page.waitForTimeout(QUIET_MS)

    // Which holds the round
    expect(urlParam(page, URL_PARAMS.COMPETITIONS)()).toBe('memo-i')
  })

  test('keeps its one stop on the row the arrows reached, so Tab and Shift+Tab leave from there', async ({
    page,
  }) => {
    // The facet, opened with nothing picked, the top of the tree holding the stop
    const panel = await openFacet(page, COMPETITION)

    // Down twice, past the top of the tree to the category under it
    await page.keyboard.press('ArrowDown')
    await page.keyboard.press('ArrowDown')

    // On category A
    await expect.poll(() => focusedRowId(page)).toBe('csmo-a')

    // Shift+Tab
    await page.keyboard.press('Shift+Tab')

    // Back in the search box, past the top of the tree
    await expect(panel.getByRole('textbox')).toBeFocused()

    // A round of MEMO picked, well below the top of the tree
    await rowOf(panel, 'memo-i').click()

    // In the address
    await expect.poll(urlParam(page, URL_PARAMS.COMPETITIONS)).toBe('memo-i')

    // Down, onto the top of the tree
    await page.keyboard.press('ArrowDown')

    // On CSMO
    await expect.poll(() => focusedRowId(page)).toBe('csmo')

    // Tab leaves the panel from there, passing the picked round by
    expect(await rowTabStops(page, panel)).toEqual([])
  })

  test('hands the stop to the closed branch a pick sits hidden in', async ({ page }) => {
    // The facet, opened
    let panel = await openFacet(page, COMPETITION)

    // A round of MEMO picked
    await rowOf(panel, 'memo-i').click()

    // In the address
    await expect.poll(urlParam(page, URL_PARAMS.COMPETITIONS)).toBe('memo-i')

    // Its competition, closed over it
    await chevronOf(panel, 'memo').click()

    // Closed
    await expect(rowOf(panel, 'memo')).toHaveAttribute('aria-expanded', 'false')

    // The facet, closed
    await page.keyboard.press('Escape')

    // And opened again
    panel = await openFacet(page, COMPETITION)

    // One stop among the rows, on the closed competition holding the pick
    expect(await rowTabStops(page, panel)).toEqual(['memo'])
  })

  test('stands in the tab order as one stop, on the top of the tree until a node is picked, then on it', async ({
    page,
  }) => {
    // The facet, opened with nothing picked
    let panel = await openFacet(page, COMPETITION)

    // One stop among the rows, on the top of the tree
    expect(await rowTabStops(page, panel)).toEqual(['csmo'])

    // Tabbing past the panel closed it
    await expect(panel).toBeHidden()

    // Opened again
    panel = await openFacet(page, COMPETITION)

    // A round of MEMO picked, which stands well below the top of the tree
    await rowOf(panel, 'memo-i').click()

    // In the address
    await expect.poll(urlParam(page, URL_PARAMS.COMPETITIONS)).toBe('memo-i')

    // The facet, closed
    await page.keyboard.press('Escape')

    // And opened again
    panel = await openFacet(page, COMPETITION)

    // One stop among the rows, on the node picked
    expect(await rowTabStops(page, panel)).toEqual(['memo-i'])
  })
})

test.describe('the header of a tree facet', () => {
  test('moves into the panel while the panel opens over the heading, and stays beside the heading otherwise', async ({
    page,
  }) => {
    // A window short enough for the panel to open above its trigger
    await page.setViewportSize(SHORT_WINDOW)

    // The facet, opened
    let panel = await openFacet(page, COMPETITION)

    // A round of MEMO picked, which gives the reset something to do
    await rowOf(panel, 'memo-i').click()

    // In the address
    await expect.poll(urlParam(page, URL_PARAMS.COMPETITIONS)).toBe('memo-i')

    // The panel carries the reset, the heading's being covered
    await expect(panelResetOf(panel)).toBeVisible()
    await expect(headingResetOf(page, COMPETITION)).toBeHidden()

    // The facet, closed
    await page.keyboard.press('Escape')

    // A window tall enough for the panel to open below its trigger
    await page.setViewportSize(TALL_WINDOW)

    // The facet, opened again, the round still picked
    panel = await openFacet(page, COMPETITION)

    // The reset stays beside the heading, and the panel carries none
    await expect(headingResetOf(page, COMPETITION)).toBeVisible()
    await expect(panelResetOf(panel)).toHaveCount(0)
  })

  test("empties the search along with the picks from the panel's reset, the whole tree back on show", async ({
    page,
  }) => {
    // A window short enough for the panel to open above its trigger, carrying the reset
    await page.setViewportSize(SHORT_WINDOW)

    // The facet, opened
    const panel = await openFacet(page, COMPETITION)

    // The search box
    const search = panel.getByRole('textbox')

    // A search only one of TST's days carries
    await search.fill(FOUND_COMPETITION_SEARCH)

    // The day it found, picked
    await rowOf(panel, FOUND_COMPETITION).click()

    // In the address
    await expect.poll(urlParam(page, URL_PARAMS.COMPETITIONS)).toBe(FOUND_COMPETITION)

    // The panel's reset, pressed
    await panelResetOf(panel).click()

    // Nothing left picked
    await expect.poll(urlParam(page, URL_PARAMS.COMPETITIONS)).toBeNull()

    // The search box emptied, the caret back in it
    await expect(search).toHaveValue('')
    await expect(search).toBeFocused()

    // And the whole tree on show again
    await expect(rowOf(panel, 'csmo')).toBeVisible()
  })
})
