import type { Locator, Page, Response } from '@playwright/test'

import type { Board } from '@/components/features/problem-selection/model/selection-types'

import messages from '../messages/en.json'
import { createAnswerGate } from './support/answer-gate'
import { recordNotices } from './support/backend-routes'
import { SELECTION_PATH } from './support/competitions'
import {
  ALGEBRA,
  boardPanel,
  cardOf,
  DRAFT_BOARD,
  FINALIZED_BOARD,
  FIRST,
  FULL_DRAFT,
  FULL_DRAFT_FINALIZED,
  headingOf,
  holdReads,
  isSlotWrite,
  LATER_DRAFT,
  ON_OFFER_COUNT,
  OPENED,
  OPENED_ADDRESS,
  openPool,
  pickBoard,
  pickState,
  placementOf,
  problemCount,
  READY,
  recordWrites,
  SELECTION_ENDPOINT,
  selectionCopy,
  selectionText,
  SET_ASIDE,
  SETTLE_TIMEOUT_MS,
  slotOf,
  statusLine,
  stubSelection,
  UNWRITTEN,
  USED,
} from './support/problem-selection'
import { expect, test } from './support/test'

/** What the page says about a write the backend refused, by the code it refused it with. */
const refusalCopy = messages.apiErrors

/** How long the page waits before reading the selection again on its own, and a second past it. */
const PAST_NEXT_READ = '00:31'

/**
 * A problem's Place button, which opens the board as a grid.
 *
 * @param scope - Where the button is, a card or a problem's own page.
 *
 * @returns The button.
 */
function placeButton(scope: Locator): Locator {
  // The only button saying Place
  return scope.getByRole('button', { name: selectionCopy.place.label, exact: true })
}

/**
 * The button putting a problem into the slot waiting for one.
 *
 * @param scope - Where the button is, a card or a problem's own page.
 * @param label - The waiting slot's short label, like E2.
 *
 * @returns The button.
 */
function putInButton(scope: Locator, label: string): Locator {
  // The button naming the slot
  return scope.getByRole('button', { name: selectionText('place.putIn', { slot: label }) })
}

/**
 * One slot in the grid a Place button opens.
 *
 * @param page - The page.
 * @param label - The slot's short label, like E2.
 *
 * @returns The slot's item.
 */
function gridSlot(page: Page, label: string): Locator {
  // The grid's only item named for the slot
  return page.getByRole('menuitem', { name: new RegExp(`^${label}: `) })
}

/**
 * Puts a problem into a slot through the grid on its Place button.
 *
 * @param scope - Where the Place button is, a card or a problem's own page.
 * @param label - The slot's short label, like E2.
 */
async function placeThroughGrid(scope: Locator, label: string): Promise<void> {
  // The grid, opened
  await placeButton(scope).click()

  // The slot, picked
  await gridSlot(scope.page(), label).click()
}

/**
 * Presses one of a filled slot's actions, which show while the slot is hovered, once it is available.
 *
 * @param page - The page.
 * @param label - The slot's short label, like E1.
 * @param action - What the action's button is called.
 */
async function pressSlotAction(page: Page, label: string, action: string): Promise<void> {
  // The slot, hovered so its actions show
  await slotOf(page, label).hover()

  // The action
  const button = slotOf(page, label).getByRole('button', { name: action, exact: true })

  // Available, no write of the selection's still out
  await expect(button).not.toHaveAttribute('aria-disabled', 'true')

  // Pressed
  await button.click()
}

/**
 * The banner saying which slot waits for a problem.
 *
 * @param page - The page.
 * @param board - The board holding the slot.
 * @param paper - The name of the paper holding it.
 * @param position - The slot's position, counted from one.
 *
 * @returns The banner's line.
 */
function waitingBanner(page: Page, board: Board, paper: string, position: number): Locator {
  // The line naming the slot
  return page.getByText(selectionText('picking.target', { board: board.name, paper, position }))
}

/**
 * Waits for the backend's answer to the next write the page sends to a board's slots.
 *
 * @param page - The page.
 *
 * @returns The answer, once it has come.
 */
function slotWriteAnswered(page: Page): Promise<Response> {
  // The next answer from a slot's address on the selection's backend
  return page.waitForResponse((response) => isSlotWrite(new URL(response.url())))
}

/**
 * The address of one slot on the backend.
 *
 * @param board - The board.
 * @param paperIndex - Which of the board's papers, from zero.
 * @param index - The slot's position in the paper, from zero.
 *
 * @returns The address.
 */
function slotAddress(board: Board, paperIndex: number, index: number): string {
  // The board, the paper and the slot, as the backend routes them
  return `${SELECTION_ENDPOINT}/boards/${board.id}/papers/${board.papers[paperIndex]!.id}/slots/${index}`
}

test.describe('placing a problem from the pool', () => {
  test('puts a problem into a slot through the grid on its card, and names the slot on the card', async ({
    page,
  }) => {
    // A reviewer whose first draft holds a problem in its first elementary slot
    await stubSelection(page, 'selection')

    // Every write the page sends to a board's slots
    const writes = recordWrites(page, isSlotWrite)

    // The pool
    await openPool(page)

    // The grid on a problem's card
    await placeButton(cardOf(page, OPENED)).click()

    // Naming the board on screen
    await expect(page.getByRole('menu')).toContainText(DRAFT_BOARD.name)

    // A filled slot, showing its problem's number and named by it
    await expect(gridSlot(page, 'E1')).toHaveText(`#${FIRST.number}`)

    // Named by the problem in it
    await expect(gridSlot(page, 'E1')).toHaveAccessibleName(
      selectionText('place.slotFilled', { slot: 'E1', number: FIRST.number, title: FIRST.title })
    )

    // An empty one, named as empty
    await expect(gridSlot(page, 'E2')).toHaveAccessibleName(
      selectionText('place.slotEmpty', { slot: 'E2' })
    )

    // Every read held from here, so the page has only the write to go on
    const releaseReads = await holdReads(page)

    // The empty one, picked
    await gridSlot(page, 'E2').click()

    // In the slot
    await expect(slotOf(page, 'E2').getByRole('link', { name: OPENED.title })).toBeVisible()

    // And named on the card
    await expect(placementOf(cardOf(page, OPENED), DRAFT_BOARD, 'E2')).toBeVisible()

    // Another slot, hovered while the write is out
    await slotOf(page, 'E1').hover()

    // Its way back to the pool unavailable until the write is over
    await expect(
      slotOf(page, 'E1').getByRole('button', { name: selectionCopy.board.backToPool })
    ).toHaveAttribute('aria-disabled', 'true')

    // The answer to the read after the write
    const readAfterWrites = page.waitForResponse(SELECTION_ENDPOINT)

    // The read after the write, let through
    releaseReads()

    // Once it has landed, the write over
    await readAfterWrites

    // Sent once, as a placement of that problem into that slot
    expect(writes().map((write) => [write.method(), write.url(), write.postDataJSON()])).toEqual([
      ['PUT', slotAddress(DRAFT_BOARD, 0, 1), { proposalId: OPENED.id }],
    ])
  })

  test('moves through the grid along a paper with left and right and between papers with up and down, placing with Enter', async ({
    page,
  }) => {
    // A reviewer whose first draft has three papers of three slots each
    await stubSelection(page, 'selection')

    // The pool
    await openPool(page)

    // The grid on a problem's card
    await placeButton(cardOf(page, OPENED)).click()

    // Its first slot, focused
    await gridSlot(page, 'E1').focus()

    // Down to the next paper
    await page.keyboard.press('ArrowDown')

    // Onto its first slot
    await expect(gridSlot(page, 'I1')).toBeFocused()

    // Right along that paper
    await page.keyboard.press('ArrowRight')

    // Onto its second slot
    await expect(gridSlot(page, 'I2')).toBeFocused()

    // Up to the first paper
    await page.keyboard.press('ArrowUp')

    // Onto the same slot there
    await expect(gridSlot(page, 'E2')).toBeFocused()

    // Up past the board's edge
    await page.keyboard.press('ArrowUp')

    // A task gone by, in which a move the grid let through would have landed
    await page.evaluate(() => new Promise((resolve) => setTimeout(resolve)))

    // Staying put
    await expect(gridSlot(page, 'E2')).toBeFocused()

    // Left along the paper
    await page.keyboard.press('ArrowLeft')

    // Onto its first slot
    await expect(gridSlot(page, 'E1')).toBeFocused()

    // Right again
    await page.keyboard.press('ArrowRight')

    // Back on the second slot
    await expect(gridSlot(page, 'E2')).toBeFocused()

    // Picked with Enter
    await page.keyboard.press('Enter')

    // The problem in that slot
    await expect(slotOf(page, 'E2').getByRole('link', { name: OPENED.title })).toBeVisible()
  })

  test('trades places with the slot it goes into when the problem already stands on the board', async ({
    page,
  }) => {
    // A reviewer whose first draft holds one problem in its first elementary slot and another in its
    // second intermediate one
    await stubSelection(page, 'selection')

    // The pool
    await openPool(page)

    // The grid on the first problem's card
    await placeButton(cardOf(page, FIRST)).click()

    // Its own slot, which it cannot go into again
    await expect(gridSlot(page, 'E1')).toBeDisabled()

    // The answer to the write, awaited before the page is read afresh
    const answered = slotWriteAnswered(page)

    // The other problem's slot, picked
    await gridSlot(page, 'I2').click()

    // In that slot
    await expect(slotOf(page, 'I2').getByRole('link', { name: FIRST.title })).toBeVisible()

    // The other problem in its old one
    await expect(slotOf(page, 'E1').getByRole('link', { name: READY.title })).toBeVisible()

    // Once the write is saved
    await answered

    // Read afresh
    await openPool(page)

    // Still traded
    await expect(slotOf(page, 'E1').getByRole('link', { name: READY.title })).toBeVisible()
  })

  test('hands the focus to the card standing in its place when a placement takes a card out of the pool, or to the count line when none does', async ({
    page,
  }) => {
    // A reviewer whose first draft holds two problems
    await stubSelection(page, 'selection')

    // The pool
    await openPool(page)

    // Showing only the problems the board on screen does not hold
    await pickState(page, selectionCopy.filters.state, selectionCopy.filters.notSelected)

    // A problem put through the grid on its card into a slot holding the next problem by number
    await placeThroughGrid(cardOf(page, OPENED), 'I2')

    // Its card gone from the pool
    await expect(cardOf(page, OPENED)).toHaveCount(0)

    // The focus on the title of the problem it replaced, back in the pool where the placed one stood
    await expect(cardOf(page, READY).getByRole('link', { name: READY.title })).toBeFocused()

    // An empty slot, waiting for a problem
    await slotOf(page, 'E3').getByRole('button').click()

    // The last card's problem, put there
    await putInButton(cardOf(page, UNWRITTEN), 'E3').click()

    // Its card gone too
    await expect(cardOf(page, UNWRITTEN)).toHaveCount(0)

    // The focus on the line counting the problems left, no card standing where the one gone stood
    await expect(problemCount(page, ON_OFFER_COUNT - 3)).toBeFocused()
  })

  test('places a problem from its own page', async ({ page }) => {
    // A reviewer whose selection holds a pool of problems and a draft to fill
    await stubSelection(page, 'selection')

    // A link to a problem
    await page.goto(OPENED_ADDRESS)

    // Its page
    await expect(headingOf(page, OPENED)).toBeVisible({ timeout: SETTLE_TIMEOUT_MS })

    // Put into the last elementary slot through the grid in its header
    await placeThroughGrid(page.getByRole('article'), 'E3')

    // In the slot
    await expect(slotOf(page, 'E3').getByRole('link', { name: OPENED.title })).toBeVisible()

    // And named on the page
    await expect(placementOf(page.getByRole('article'), DRAFT_BOARD, 'E3')).toBeVisible()
  })

  test('hands the focus to the count line when a problem placed from its own page has left the pool on going back', async ({
    page,
  }) => {
    // A reviewer whose selection holds a pool of problems and a draft to fill
    await stubSelection(page, 'selection')

    // The pool
    await openPool(page)

    // Showing only the problems the board on screen does not hold
    await pickState(page, selectionCopy.filters.state, selectionCopy.filters.notSelected)

    // A problem opened from its card
    await cardOf(page, OPENED).getByRole('link', { name: OPENED.title }).click()

    // Its page
    await expect(headingOf(page, OPENED)).toBeVisible()

    // Put into the last elementary slot through the grid in its header
    await placeThroughGrid(page.getByRole('article'), 'E3')

    // In the slot
    await expect(slotOf(page, 'E3').getByRole('link', { name: OPENED.title })).toBeVisible()

    // Back to the pool
    await page.getByRole('link', { name: selectionCopy.detail.backToPool }).click()

    // Its card gone from it, the board now holding the problem
    await expect(cardOf(page, OPENED)).toHaveCount(0)

    // The focus on the line counting the problems left
    await expect(problemCount(page, ON_OFFER_COUNT - 3)).toBeFocused()
  })

  test('offers no placing for a problem set aside or taken by a round', async ({ page }) => {
    // A reviewer whose selection holds a problem set aside and one a round took
    await stubSelection(page, 'selection')

    // The pool
    await openPool(page)

    // The set-aside problems
    await page
      .getByRole('button', { name: selectionText('filters.setAside', { count: 1 }) })
      .click()

    // The one set aside, without a way to place it
    await expect(cardOf(page, SET_ASIDE)).toBeVisible()

    // Offering none
    await expect(placeButton(cardOf(page, SET_ASIDE))).toHaveCount(0)

    // A link to the problem the round took
    await page.goto(`${SELECTION_PATH}?problem=${USED.id}`)

    // Its page
    await expect(headingOf(page, USED)).toBeVisible({ timeout: SETTLE_TIMEOUT_MS })

    // Offering none either
    await expect(placeButton(page.getByRole('article'))).toHaveCount(0)
  })
})

test.describe('a slot waiting for a problem', () => {
  test('an empty slot waits for the next problem picked from the pool, which goes into it', async ({
    page,
  }) => {
    // A reviewer whose first draft has empty slots
    await stubSelection(page, 'selection')

    // The pool
    await openPool(page)

    // The second elementary slot, which stands empty, picked
    await slotOf(page, 'E2').getByRole('button').click()

    // Pressed
    await expect(slotOf(page, 'E2').getByRole('button')).toHaveAttribute('aria-pressed', 'true')

    // Saying what comes next
    await expect(slotOf(page, 'E2')).toContainText(selectionCopy.board.pickFromPool)

    // Which a screen reader hears as the button's description
    await expect(slotOf(page, 'E2').getByRole('button')).toHaveAccessibleDescription(
      selectionCopy.board.pickFromPool
    )

    // The button keeping the name it had before it was pressed
    await expect(slotOf(page, 'E2').getByRole('button')).toHaveAccessibleName(
      `E2 ${selectionCopy.board.empty}`
    )

    // The banner over the pool naming it
    await expect(waitingBanner(page, DRAFT_BOARD, 'Elementary', 2)).toBeVisible()

    // Each card offering to put its problem there, in place of the grid
    await expect(putInButton(cardOf(page, ALGEBRA), 'E2')).toBeVisible()

    // With no grid left to open
    await expect(placeButton(cardOf(page, ALGEBRA))).toHaveCount(0)

    // A problem, put there
    await putInButton(cardOf(page, OPENED), 'E2').click()

    // In the slot
    await expect(slotOf(page, 'E2').getByRole('link', { name: OPENED.title })).toBeVisible()

    // The slot no longer waiting
    await expect(waitingBanner(page, DRAFT_BOARD, 'Elementary', 2)).toHaveCount(0)

    // The focus on the card's Place button, where the pressed one stood
    await expect(placeButton(cardOf(page, OPENED))).toBeFocused()
  })

  test('a filled slot waits for a replacement, kept if the reviewer changes their mind', async ({
    page,
  }) => {
    // A reviewer whose first draft holds a problem in its first elementary slot
    await stubSelection(page, 'selection')

    // The pool
    await openPool(page)

    // That slot, set to wait for a replacement
    await pressSlotAction(page, 'E1', selectionCopy.board.replace)

    // The banner naming it
    await expect(waitingBanner(page, DRAFT_BOARD, 'Elementary', 1)).toBeVisible()

    // The slot's own problem saying it is already there, with nothing to press
    await expect(
      cardOf(page, FIRST).getByRole('button', {
        name: selectionText('place.alreadyIn', { slot: 'E1' }),
        exact: true,
      })
    ).toBeDisabled()

    // Kept after all
    await pressSlotAction(page, 'E1', selectionCopy.board.keep)

    // No longer waiting
    await expect(waitingBanner(page, DRAFT_BOARD, 'Elementary', 1)).toHaveCount(0)

    // Set to wait again
    await pressSlotAction(page, 'E1', selectionCopy.board.replace)

    // Another problem, put there
    await putInButton(cardOf(page, ALGEBRA), 'E1').click()

    // In the slot
    await expect(slotOf(page, 'E1').getByRole('link', { name: ALGEBRA.title })).toBeVisible()

    // The problem it replaced back in the pool, on no slot of the board
    await expect(cardOf(page, FIRST).getByText(DRAFT_BOARD.name, { exact: true })).toHaveCount(0)
  })

  test('lets the waiting slot go from the banner, and when another board goes on screen', async ({
    page,
  }) => {
    // A reviewer whose selection holds two drafts
    await stubSelection(page, 'selection')

    // The pool
    await openPool(page)

    // An empty slot, waiting
    await slotOf(page, 'E2').getByRole('button').click()

    // Let go from the banner
    await page.getByRole('button', { name: selectionCopy.picking.stop }).click()

    // No longer waiting
    await expect(slotOf(page, 'E2').getByRole('button')).toHaveAttribute('aria-pressed', 'false')

    // The focus on the line under where the banner was
    await expect(problemCount(page, ON_OFFER_COUNT)).toBeFocused()

    // Waiting again
    await slotOf(page, 'E2').getByRole('button').click()

    // Pressed
    await expect(slotOf(page, 'E2').getByRole('button')).toHaveAttribute('aria-pressed', 'true')

    // The later draft, put on screen
    await pickBoard(page, DRAFT_BOARD, LATER_DRAFT)

    // The first draft, back on screen
    await pickBoard(page, LATER_DRAFT, DRAFT_BOARD)

    // Its slot no longer waiting either
    await expect(slotOf(page, 'E2').getByRole('button')).toHaveAttribute('aria-pressed', 'false')
  })

  test('lets the waiting slot go when a move changes what it holds, from either side of the trade', async ({
    page,
  }) => {
    // A reviewer whose first draft holds a problem in its first elementary slot and its second intermediate one
    await stubSelection(page, 'selection')

    // The pool
    await openPool(page)

    // That slot, set to wait for a replacement
    await pressSlotAction(page, 'E1', selectionCopy.board.replace)

    // The banner naming it
    await expect(waitingBanner(page, DRAFT_BOARD, 'Elementary', 1)).toBeVisible()

    // Its problem, moved down
    await pressSlotAction(page, 'E1', selectionCopy.board.moveDown)

    // In the slot below
    await expect(slotOf(page, 'E2').getByRole('link', { name: FIRST.title })).toBeVisible()

    // And the slot no longer waiting, since what it held has moved
    await expect(waitingBanner(page, DRAFT_BOARD, 'Elementary', 1)).toHaveCount(0)

    // The first intermediate slot, empty, waiting for a problem
    await slotOf(page, 'I1').getByRole('button').click()

    // The banner naming it
    await expect(waitingBanner(page, DRAFT_BOARD, 'Intermediate', 1)).toBeVisible()

    // The problem in the slot below it, moved up into it
    await pressSlotAction(page, 'I2', selectionCopy.board.moveUp)

    // Now in the waiting slot
    await expect(slotOf(page, 'I1').getByRole('link', { name: READY.title })).toBeVisible()

    // Which no longer waits, since the move has filled it
    await expect(waitingBanner(page, DRAFT_BOARD, 'Intermediate', 1)).toHaveCount(0)
  })

  test('lets the waiting slot go once another reviewer finalizes the board under it, the focus going to the line saying where it went', async ({
    page,
  }) => {
    // The clock under the test's hand, so the next read comes when the test says
    await page.clock.install()

    // A reviewer whose first draft is full and ready to be finalized
    const answerSelectionWith = await stubSelection(page, 'fullDraft')

    // The pool
    await openPool(page)

    // Its slot, waiting for a replacement
    await pressSlotAction(page, 'E1', selectionCopy.board.replace)

    // The banner naming it
    await expect(waitingBanner(page, FULL_DRAFT, 'Elementary', 1)).toBeVisible()

    // The focus on a problem's way into it
    await putInButton(cardOf(page, OPENED), 'E1').focus()

    // A later read, by which another reviewer has finalized it
    answerSelectionWith('fullDraftFinalized')

    // Long enough for the selection to be read again
    await page.clock.fastForward(PAST_NEXT_READ)

    // Once the read has landed, which the line about its rounds shows
    await expect(statusLine(page, FULL_DRAFT_FINALIZED)).toBeVisible({
      timeout: SETTLE_TIMEOUT_MS,
    })

    // The slot no longer waiting
    await expect(waitingBanner(page, FULL_DRAFT, 'Elementary', 1)).toHaveCount(0)

    // The focus, gone with the problem's way in, on the line saying where the board went
    await expect(statusLine(page, FULL_DRAFT_FINALIZED)).toBeFocused()
  })
})

test.describe("moving and emptying a draft's slots", () => {
  test('moves a slot up and down its paper, never past either end', async ({ page }) => {
    // A reviewer whose first draft holds a problem in its second intermediate slot
    await stubSelection(page, 'selection')

    // The pool
    await openPool(page)

    // That slot, moved up
    await pressSlotAction(page, 'I2', selectionCopy.board.moveUp)

    // Its problem in the first slot
    await expect(slotOf(page, 'I1').getByRole('link', { name: READY.title })).toBeVisible()

    // The second one empty
    await expect(slotOf(page, 'I2')).toContainText(selectionCopy.board.empty)

    // The focus gone along with the problem, onto its way up from where it stands now
    await expect(
      slotOf(page, 'I1').getByRole('button', { name: selectionCopy.board.moveUp })
    ).toBeFocused()

    // The first slot, hovered
    await slotOf(page, 'I1').hover()

    // Once no write is out, which its way down shows
    await expect(
      slotOf(page, 'I1').getByRole('button', { name: selectionCopy.board.moveDown })
    ).not.toHaveAttribute('aria-disabled', 'true')

    // With nothing above it to trade with
    await expect(
      slotOf(page, 'I1').getByRole('button', { name: selectionCopy.board.moveUp })
    ).toHaveAttribute('aria-disabled', 'true')

    // Moved down twice
    await pressSlotAction(page, 'I1', selectionCopy.board.moveDown)

    // Into the second slot
    await expect(slotOf(page, 'I2').getByRole('link', { name: READY.title })).toBeVisible()

    // Then down again
    await pressSlotAction(page, 'I2', selectionCopy.board.moveDown)

    // Into the last one
    await expect(slotOf(page, 'I3').getByRole('link', { name: READY.title })).toBeVisible()

    // Hovered
    await slotOf(page, 'I3').hover()

    // Once no write is out, which its way up shows
    await expect(
      slotOf(page, 'I3').getByRole('button', { name: selectionCopy.board.moveUp })
    ).not.toHaveAttribute('aria-disabled', 'true')

    // With nothing below it to trade with
    await expect(
      slotOf(page, 'I3').getByRole('button', { name: selectionCopy.board.moveDown })
    ).toHaveAttribute('aria-disabled', 'true')

    // Read afresh
    await openPool(page)

    // Still in the last slot
    await expect(slotOf(page, 'I3').getByRole('link', { name: READY.title })).toBeVisible()
  })

  test('keeps the focus on a problem traded with the one beside it, so pressing again carries it further', async ({
    page,
  }) => {
    // A reviewer whose first draft holds a problem in its first elementary slot
    await stubSelection(page, 'selection')

    // The pool
    await openPool(page)

    // Another problem, put into the slot below it, so the two stand side by side
    await placeThroughGrid(cardOf(page, OPENED), 'E2')

    // The first slot's way down
    const firstDown = slotOf(page, 'E1').getByRole('button', { name: selectionCopy.board.moveDown })

    // Available once no write is out
    await expect(firstDown).not.toHaveAttribute('aria-disabled', 'true')

    // Focused
    await firstDown.focus()

    // And pressed from the keyboard
    await page.keyboard.press('Enter')

    // The two problems traded
    await expect(slotOf(page, 'E1').getByRole('link', { name: OPENED.title })).toBeVisible()

    // The moved one in the second slot
    await expect(slotOf(page, 'E2').getByRole('link', { name: FIRST.title })).toBeVisible()

    // The second slot's way down
    const secondDown = slotOf(page, 'E2').getByRole('button', {
      name: selectionCopy.board.moveDown,
    })

    // Holding the focus, gone along with the moved problem
    await expect(secondDown).toBeFocused()

    // Available once no write is out
    await expect(secondDown).not.toHaveAttribute('aria-disabled', 'true')

    // Pressed again
    await page.keyboard.press('Enter')

    // The problem carried on into the last slot, not traded back
    await expect(slotOf(page, 'E3').getByRole('link', { name: FIRST.title })).toBeVisible()
  })

  test('leaves the focus where the reader took it when a failed move puts the problem back', async ({
    page,
  }) => {
    // A reviewer whose first draft holds a problem in its first elementary slot
    await stubSelection(page, 'selection')

    // The pool
    await openPool(page)

    // The gate a move of the first slot waits at
    const moveGate = createAnswerGate()

    // Where that move waits, then fails, its connection lost
    await page.route(`${slotAddress(DRAFT_BOARD, 0, 0)}/move`, async (route) => {
      // Waiting until the gate is open
      await moveGate.passed()

      // Then lost on the way
      await route.abort('connectionreset')
    })

    // Shut, so the move stays out while the reader goes elsewhere
    const releaseMove = moveGate.hold()

    // The first slot's problem, moved down
    await pressSlotAction(page, 'E1', selectionCopy.board.moveDown)

    // Shown in the second slot ahead of the server
    await expect(slotOf(page, 'E2').getByRole('link', { name: FIRST.title })).toBeVisible()

    // The search
    const search = page.getByRole('searchbox', { name: selectionCopy.pool.search })

    // Where the reader goes meanwhile
    await search.focus()

    // The move let through, to fail
    releaseMove()

    // The problem back in the first slot
    await expect(slotOf(page, 'E1').getByRole('link', { name: FIRST.title })).toBeVisible()

    // Once the write is over, which the slot's way down coming back shows
    await expect(
      slotOf(page, 'E1').getByRole('button', { name: selectionCopy.board.moveDown })
    ).not.toHaveAttribute('aria-disabled', 'true')

    // The focus still in the search, the problem coming back having left it there
    await expect(search).toBeFocused()
  })

  test("sends a slot's problem back to the pool, the emptied slot taking the focus", async ({
    page,
  }) => {
    // A reviewer whose first draft holds a problem in its first elementary slot
    await stubSelection(page, 'selection')

    // The pool
    await openPool(page)

    // The answer to the write, awaited before the page is read afresh
    const answered = slotWriteAnswered(page)

    // Its problem, sent back to the pool
    await pressSlotAction(page, 'E1', selectionCopy.board.backToPool)

    // The slot empty
    await expect(slotOf(page, 'E1')).toContainText(selectionCopy.board.empty)

    // Holding the focus the pressed button had
    await expect(slotOf(page, 'E1').getByRole('button')).toBeFocused()

    // The problem on no slot of the board
    await expect(cardOf(page, FIRST).getByText(DRAFT_BOARD.name, { exact: true })).toHaveCount(0)

    // Once the write is saved
    await answered

    // Read afresh
    await openPool(page)

    // Still empty
    await expect(slotOf(page, 'E1')).toContainText(selectionCopy.board.empty)
  })
})

test.describe('presses while a write changing the slots is out', () => {
  test('drops every press on the slots while a write to them is out, the slot they would fill left waiting', async ({
    page,
  }) => {
    // A reviewer whose first draft holds a problem in its first elementary slot and its second intermediate one
    await stubSelection(page, 'selection')

    // Every write the page sends to a board's slots
    const writes = recordWrites(page, isSlotWrite)

    // The pool
    await openPool(page)

    // The first intermediate slot, waiting for a problem
    await slotOf(page, 'I1').getByRole('button').click()

    // A problem's way into it
    const putIn = await putInButton(cardOf(page, OPENED), 'I1').elementHandle()

    // The way up of the problem below it, which would trade that problem into it
    const moveUpInto = await slotOf(page, 'I2')
      .getByRole('button', { name: selectionCopy.board.moveUp })
      .elementHandle()

    // The answer to the read after the write
    const readAfterWrite = page.waitForResponse(SELECTION_ENDPOINT)

    // The first slot's way down, then both ways into the waiting slot, all pressed before the page draws again
    await slotOf(page, 'E1')
      .getByRole('button', { name: selectionCopy.board.moveDown })
      .evaluate(
        (moveDown, { up, into }) => {
          // Each press a click, one straight after the other
          for (const button of [moveDown, up, into]) {
            button?.dispatchEvent(new MouseEvent('click', { bubbles: true }))
          }
        },
        { up: moveUpInto, into: putIn }
      )

    // Once that read has landed
    await readAfterWrite

    // And the write has settled, which the moved problem's way on down shows, any press held back behind it
    // having gone out by then
    await expect(
      slotOf(page, 'E2').getByRole('button', { name: selectionCopy.board.moveDown })
    ).not.toHaveAttribute('aria-disabled', 'true')

    // Only the first press sent
    expect(writes().map((write) => [write.method(), write.url()])).toEqual([
      ['POST', `${slotAddress(DRAFT_BOARD, 0, 0)}/move`],
    ])

    // The problem moved down once
    await expect(slotOf(page, 'E2').getByRole('link', { name: FIRST.title })).toBeVisible()

    // The problem below the waiting slot still there
    await expect(slotOf(page, 'I2').getByRole('link', { name: READY.title })).toBeVisible()

    // And the slot still waiting for a problem, both presses into it having been dropped
    await expect(waitingBanner(page, DRAFT_BOARD, 'Intermediate', 1)).toBeVisible()
  })
})

test.describe('a finalized board', () => {
  test('shows its slots read-only, and takes no problem from the pool', async ({ page }) => {
    // A reviewer whose selection holds a finalized board
    await stubSelection(page, 'selection')

    // The pool
    await openPool(page)

    // The finalized board, on screen
    await pickBoard(page, DRAFT_BOARD, FINALIZED_BOARD)

    // Its rounds, and the day they open
    await expect(statusLine(page, FINALIZED_BOARD)).toBeVisible()

    // A slot, hovered
    await slotOf(page, 'E1').hover()

    // Showing its problem
    await expect(slotOf(page, 'E1').getByRole('link', { name: USED.title })).toBeVisible()

    // With no way to replace, move or empty it
    await expect(slotOf(page, 'E1').getByRole('button')).toHaveCount(0)

    // A problem in the pool
    await expect(cardOf(page, OPENED)).toBeVisible()

    // Offering no way onto the board
    await expect(placeButton(cardOf(page, OPENED))).toHaveCount(0)
  })

  test('leaves the focus where the reader keeps it when another reviewer finalizes the board on screen', async ({
    page,
  }) => {
    // The clock under the test's hand, so the next read comes when the test says
    await page.clock.install()

    // A reviewer whose first draft is full and ready to be finalized
    const answerSelectionWith = await stubSelection(page, 'fullDraft')

    // The pool
    await openPool(page)

    // The search
    const search = page.getByRole('searchbox', { name: selectionCopy.pool.search })

    // Focused, the reader about to type
    await search.focus()

    // A later read, by which another reviewer has finalized the board
    answerSelectionWith('fullDraftFinalized')

    // Long enough for the selection to be read again
    await page.clock.fastForward(PAST_NEXT_READ)

    // Once the read has landed, which the line about its rounds shows
    await expect(statusLine(page, FULL_DRAFT_FINALIZED)).toBeVisible({
      timeout: SETTLE_TIMEOUT_MS,
    })

    // The focus still in the search, the change having taken nothing it stood on
    await expect(search).toBeFocused()
  })
})

test.describe('a write the backend refuses', () => {
  test('puts an emptied slot back when another reviewer finalized the board meanwhile, and says why', async ({
    page,
  }) => {
    // A reviewer whose first draft is full and ready to be finalized
    const answerSelectionWith = await stubSelection(page, 'fullDraft')

    // Every notice the page raises
    const notices = await recordNotices(page)

    // The pool
    await openPool(page)

    // Another reviewer finalizing it, which the page has not read yet
    answerSelectionWith('fullDraftFinalized')

    // Every read held from here, so the page has only the refusal to go on
    const releaseReads = await holdReads(page)

    // Its problem, sent back to the pool all the same
    await pressSlotAction(page, 'E1', selectionCopy.board.backToPool)

    // Refused, the reader told why
    await expect.poll(notices).toEqual([refusalCopy.SelectionBoardFinalized])

    // The problem back in its slot
    await expect(slotOf(page, 'E1').getByRole('link', { name: READY.title })).toBeVisible()

    // The read after the write, let through
    releaseReads()

    // Which has the board finalized
    await expect(statusLine(page, FULL_DRAFT_FINALIZED)).toBeVisible()

    // Its slot offering no change any more
    await expect(slotOf(page, 'E1').getByRole('button')).toHaveCount(0)

    // And no other notice raised
    expect(notices()).toEqual([refusalCopy.SelectionBoardFinalized])
  })

  test('refuses a placement when a round took the problem meanwhile, and shows it gone', async ({
    page,
  }) => {
    // A reviewer whose first draft is full, and a later draft holding the same problem
    const answerSelectionWith = await stubSelection(page, 'fullDraft')

    // Every notice the page raises
    const notices = await recordNotices(page)

    // The pool
    await openPool(page)

    // The later draft, on screen
    await pickBoard(page, FULL_DRAFT, LATER_DRAFT)

    // Another reviewer finalizing the first, whose round takes the problem
    answerSelectionWith('fullDraftFinalized')

    // The problem, moved into the later draft's second elementary slot all the same
    await placeThroughGrid(cardOf(page, READY), 'E2')

    // Refused, the reader told why
    await expect.poll(notices).toEqual([refusalCopy.SelectionProposalUsed])

    // And the selection read again, which has the problem out of the pool
    await expect(cardOf(page, READY)).toHaveCount(0)

    // And on no slot of the later draft
    await expect(boardPanel(page).getByRole('link', { name: READY.title })).toHaveCount(0)

    // With no other notice raised
    expect(notices()).toEqual([refusalCopy.SelectionProposalUsed])
  })

  test('refuses a write to a board whose rounds opened meanwhile, which then leaves the page, the focus going to the menu of boards', async ({
    page,
  }) => {
    // A reviewer whose first draft is full and ready to be finalized
    const answerSelectionWith = await stubSelection(page, 'fullDraft')

    // Every notice the page raises
    const notices = await recordNotices(page)

    // The pool
    await openPool(page)

    // Another reviewer finalizing it, and its rounds opening since, none of which the page has read yet
    answerSelectionWith('fullDraftOpened')

    // Its problem, sent back to the pool all the same
    await pressSlotAction(page, 'E1', selectionCopy.board.backToPool)

    // Refused, the reader told why
    await expect.poll(notices).toEqual([refusalCopy.SelectionBoardOpened])

    // And the selection read again, without the board, which puts the later draft on screen
    await expect(boardPanel(page).getByRole('button', { name: LATER_DRAFT.name })).toBeVisible()

    // The focus, gone with the board's slots, on the menu of the boards left
    await expect(boardPanel(page).getByRole('button', { name: LATER_DRAFT.name })).toBeFocused()

    // With no other notice raised
    expect(notices()).toEqual([refusalCopy.SelectionBoardOpened])
  })

  test('says a write went through when the page cannot read the selection back', async ({
    page,
  }) => {
    // A reviewer whose first draft holds a problem in its first elementary slot
    const answerSelectionWith = await stubSelection(page, 'selection')

    // Every notice the page raises
    const notices = await recordNotices(page)

    // The pool
    await openPool(page)

    // Every read from here on failing
    answerSelectionWith('failure')

    // The slot's problem, sent back to the pool
    await pressSlotAction(page, 'E1', selectionCopy.board.backToPool)

    // Saved, the reader told the page could not show it
    await expect.poll(notices).toEqual([selectionCopy.writes.refreshFailed])

    // The slot left empty, as the write had it
    await expect(slotOf(page, 'E1')).toContainText(selectionCopy.board.empty)

    // With no other notice raised
    expect(notices()).toEqual([selectionCopy.writes.refreshFailed])
  })
})
