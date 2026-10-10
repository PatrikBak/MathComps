import type { Locator, Page } from '@playwright/test'

import type {
  Board,
  Cycle,
  Proposal,
} from '@/components/features/problem-selection/model/selection-types'

import messages from '../messages/en.json'
import { createAnswerGate } from './support/answer-gate'
import { recordNotices } from './support/backend-routes'
import { SELECTION_PATH } from './support/competitions'
import {
  boardPanel,
  cardOf,
  DECEMBER,
  DRAFT_BOARD,
  FIRST,
  FULL_DRAFT,
  FULL_DRAFT_FINALIZED,
  GEOMETRY,
  headingOf,
  holdReads,
  isFinalization,
  isProposalWrite,
  LATER_DRAFT,
  NOVEMBER,
  ON_OFFER_COUNT,
  OPENED,
  OPENED_ADDRESS,
  openPool,
  pickBoard,
  pluralText,
  problemCount,
  READY,
  recordWrites,
  SELECTION_ENDPOINT,
  selectionCopy,
  selectionText,
  SETTLE_TIMEOUT_MS,
  slotOf,
  statusLine,
  stubSelection,
  USED,
  WINTER,
} from './support/problem-selection'
import { expect, test } from './support/test'

/** What the page says about a write the backend refused, by the code it refused it with. */
const refusalCopy = messages.apiErrors

/** What each category is called. */
const categoryCopy = messages.competitions.categories

/**
 * The button opening a problem's menu of rarer actions.
 *
 * @param scope - Where the button is, a card or a problem's own page.
 * @param proposal - The problem.
 *
 * @returns The button.
 */
function actionsButton(scope: Locator | Page, proposal: Proposal): Locator {
  // The only button naming the problem's actions
  return scope.getByRole('button', {
    name: selectionText('actions.moreFor', { number: proposal.number }),
  })
}

/**
 * Picks one of a problem's rarer actions from its menu, on its card or on its own page, whichever shows.
 *
 * @param page - The page.
 * @param proposal - The problem.
 * @param action - What the action is called.
 */
async function pickAction(page: Page, proposal: Proposal, action: string): Promise<void> {
  // The menu, opened
  await actionsButton(page, proposal).click()

  // The action, picked
  await page.getByRole('menuitem', { name: action, exact: true }).click()
}

/**
 * The question asked before a problem is deleted.
 *
 * @param page - The page.
 * @param proposal - The problem.
 *
 * @returns The dialog.
 */
function deleteQuestion(page: Page, proposal: Proposal): Locator {
  // The dialog naming the problem
  return page.getByRole('dialog', {
    name: selectionText('actions.deleteTitle', { number: proposal.number }),
  })
}

/**
 * The board's button opening the finalize dialog.
 *
 * @param page - The page.
 *
 * @returns The button.
 */
function finalizeButton(page: Page): Locator {
  // The board's only button saying Finalize
  return boardPanel(page).getByRole('button', { name: selectionCopy.board.finalize, exact: true })
}

/**
 * The dialog asking which cycle's rounds a board fills.
 *
 * @param page - The page.
 * @param board - The board being finalized.
 *
 * @returns The dialog.
 */
function finalizeDialog(page: Page, board: Board): Locator {
  // The dialog naming the board
  return page.getByRole('dialog', { name: selectionText('finalize.title', { board: board.name }) })
}

/**
 * One cycle on offer in the finalize dialog.
 *
 * @param dialog - The dialog.
 * @param cycle - The cycle.
 *
 * @returns The cycle's radio.
 */
function cycleOption(dialog: Locator, cycle: Cycle): Locator {
  // The radio named first by the cycle, then by anything keeping the papers out of it and the day it opens
  return dialog.getByRole('radio', { name: new RegExp(`^${cycle.name}`) })
}

/**
 * Opens the finalize dialog for the board on screen, and waits until its choice of cycles is drawn.
 *
 * @param page - The page.
 * @param board - The board on screen.
 *
 * @returns The dialog.
 */
async function openFinalize(page: Page, board: Board): Promise<Locator> {
  // The board's Finalize, pressed
  await finalizeButton(page).click()

  // The dialog
  const dialog = finalizeDialog(page, board)

  // Once its choice is drawn
  await expect(dialog.getByRole('button', { name: selectionCopy.finalize.confirm })).toBeVisible()

  // Handed back for the test to go on in
  return dialog
}

/**
 * Presses the finalize dialog's own Finalize, which sends the board into the cycle picked.
 *
 * @param dialog - The dialog.
 */
async function confirmFinalize(dialog: Locator): Promise<void> {
  // The dialog's only button saying Finalize
  await dialog.getByRole('button', { name: selectionCopy.finalize.confirm }).click()
}

/**
 * Records every write to a problem and every read of the selection from now on, in the order they go out.
 *
 * @param page - The page.
 *
 * @returns A function which hands back what has gone out so far: each write as what it sent, each read as 'read'.
 */
function recordTraffic(page: Page): () => unknown[] {
  // Every write to a problem and every read of the selection
  const requests = recordWrites(
    page,
    (url) => isProposalWrite(url) || url.href === SELECTION_ENDPOINT
  )

  // A function which names each, a read by the word and a write by what it sent
  return () =>
    requests().map((request) => (request.method() === 'GET' ? 'read' : request.postDataJSON()))
}

/**
 * Holds the backend's answer to every write to a problem from now on, until the test lets them through, so what
 * the page does meanwhile is its own doing.
 *
 * @param page - The page.
 *
 * @returns A function which lets the held answers, and every later one, through.
 */
async function holdProposalWrites(page: Page): Promise<() => void> {
  // The gate every answer waits at
  const gate = createAnswerGate()

  // Every write to a problem held at it, then answered by the fake behind
  await page.route(isProposalWrite, async (route) => {
    // Waiting until the gate is open
    await gate.passed()

    // Then answered
    await route.fallback()
  })

  // Shut from here on, handing back the way to open it
  return gate.hold()
}

test.describe('recommending a problem for a category', () => {
  test("switches one category at a time from a card's menu, which stays open, and keeps it once read again", async ({
    page,
  }) => {
    // A reviewer whose geometry problem is recommended for the advanced category alone
    await stubSelection(page, 'selection')

    // Every write the page sends to a problem
    const writes = recordWrites(page, isProposalWrite)

    // The pool
    await openPool(page)

    // The menu on the problem's card
    await actionsButton(cardOf(page, GEOMETRY), GEOMETRY).click()

    // Its advanced category checked, its elementary one not
    await expect(page.getByRole('menuitemcheckbox', { name: categoryCopy.advanced })).toBeChecked()
    await expect(
      page.getByRole('menuitemcheckbox', { name: categoryCopy.elementary })
    ).not.toBeChecked()

    // The answer to the read after the write
    const readAfterWrite = page.waitForResponse(SELECTION_ENDPOINT)

    // The elementary one, switched on
    await page.getByRole('menuitemcheckbox', { name: categoryCopy.elementary }).click()

    // Checked, the menu still open for the next switch
    await expect(
      page.getByRole('menuitemcheckbox', { name: categoryCopy.elementary })
    ).toBeChecked()

    // And named on the card, beside the one it had
    await expect(
      cardOf(page, GEOMETRY).getByText(categoryCopy.elementary, { exact: true })
    ).toBeVisible()

    // Once the read has landed
    await readAfterWrite

    // Sent once, as that one category switched on
    expect(writes().map((write) => [write.method(), write.url(), write.postDataJSON()])).toEqual([
      [
        'PUT',
        `${SELECTION_ENDPOINT}/proposals/${GEOMETRY.id}/recommended`,
        { category: 'elementary', isRecommended: true },
      ],
    ])

    // The menu, closed from the keyboard
    await page.keyboard.press('Escape')

    // The focus back on its button
    await expect(actionsButton(cardOf(page, GEOMETRY), GEOMETRY)).toBeFocused()
  })

  test('takes a second switch made while the first is out, and reads the selection once, after both', async ({
    page,
  }) => {
    // A reviewer whose geometry problem is recommended for the advanced category alone
    await stubSelection(page, 'selection')

    // The pool
    await openPool(page)

    // What goes out from here
    const traffic = recordTraffic(page)

    // The backend's answers held from here
    const release = await holdProposalWrites(page)

    // The menu on the problem's card
    await actionsButton(cardOf(page, GEOMETRY), GEOMETRY).click()

    // The elementary category
    const elementary = page.getByRole('menuitemcheckbox', { name: categoryCopy.elementary })

    // Switched on
    await elementary.click()

    // Checked at once
    await expect(elementary).toBeChecked()

    // Deleting the problem still available while that write is out
    await expect(
      page.getByRole('menuitem', { name: messages.ui.actions.delete, exact: true })
    ).not.toHaveAttribute('aria-disabled', 'true')

    // The intermediate category
    const intermediate = page.getByRole('menuitemcheckbox', { name: categoryCopy.intermediate })

    // Switched on before the first write is answered
    await intermediate.click()

    // Checked beside the first
    await expect(intermediate).toBeChecked()
    await expect(elementary).toBeChecked()

    // The answer to the first read from here
    const firstRead = page.waitForResponse(SELECTION_ENDPOINT)

    // The answers let through
    release()

    // Once that read has landed
    await firstRead

    // Both switches sent one after the other before it, the selection read only after the second
    expect(traffic()).toEqual([
      { category: 'elementary', isRecommended: true },
      { category: 'intermediate', isRecommended: true },
      'read',
    ])

    // Both still checked
    await expect(intermediate).toBeChecked()
    await expect(elementary).toBeChecked()
  })

  test('reads the selection at once after a refused switch, though a second one waits behind it', async ({
    page,
  }) => {
    // A reviewer with a problem on offer, recommended for the intermediate category alone
    const answerSelectionWith = await stubSelection(page, 'selection')

    // The pool
    await openPool(page)

    // What goes out from here
    const traffic = recordTraffic(page)

    // Another reviewer deleting the problem, which the page has not read
    answerSelectionWith('openedDeleted')

    // The backend's answers held from here
    const release = await holdProposalWrites(page)

    // The menu on the problem's card
    await actionsButton(cardOf(page, OPENED), OPENED).click()

    // The elementary category
    const elementary = page.getByRole('menuitemcheckbox', { name: categoryCopy.elementary })

    // Switched on
    await elementary.click()

    // Checked at once
    await expect(elementary).toBeChecked()

    // The advanced category
    const advanced = page.getByRole('menuitemcheckbox', { name: categoryCopy.advanced })

    // Switched on before the first write is answered
    await advanced.click()

    // Checked at once
    await expect(advanced).toBeChecked()

    // The answers let through, each refusing the switch it answers
    release()

    // The selection read after the first refusal, ahead of the second switch, and again after that one
    await expect
      .poll(traffic)
      .toEqual([
        { category: 'elementary', isRecommended: true },
        'read',
        { category: 'advanced', isRecommended: true },
        'read',
      ])
  })

  test('lets the read after a refused write land, though a switch is made while it is out', async ({
    page,
  }) => {
    // A reviewer whose first draft is full and ready to be finalized
    const answerSelectionWith = await stubSelection(page, 'fullDraft')

    // The pool
    await openPool(page)

    // Another reviewer finalizing it, which the page has not read yet
    answerSelectionWith('fullDraftFinalized')

    // Every read held from here, so the read after the refusal stays out
    const releaseReads = await holdReads(page)

    // The backend's answers to writes to a problem held for good, so a switch never gets as far as its own read
    await holdProposalWrites(page)

    // The read after the refusal, once it goes out
    const refusalRead = page.waitForRequest(SELECTION_ENDPOINT)

    // The board's elementary slot, hovered so its actions show
    await slotOf(page, 'E1').hover()

    // Its problem sent back to the pool all the same, which the backend refuses
    await slotOf(page, 'E1')
      .getByRole('button', { name: selectionCopy.board.backToPool, exact: true })
      .click()

    // Once that read is out
    await refusalRead

    // The menu on the geometry problem's card
    await actionsButton(cardOf(page, GEOMETRY), GEOMETRY).click()

    // Its elementary category
    const elementary = page.getByRole('menuitemcheckbox', { name: categoryCopy.elementary })

    // Switched on meanwhile
    await elementary.click()

    // Checked at once
    await expect(elementary).toBeChecked()

    // The read after the refusal, let through
    releaseReads()

    // Landed, the board shown finalized
    await expect(statusLine(page, FULL_DRAFT_FINALIZED)).toBeVisible()
  })
})

test.describe('setting a problem aside', () => {
  test('takes a problem out of the pool, and brings it back from the set-aside view', async ({
    page,
  }) => {
    // A reviewer with one problem set aside already
    await stubSelection(page, 'selection')

    // Every write the page sends to a problem
    const writes = recordWrites(page, isProposalWrite)

    // The pool
    await openPool(page)

    // A problem set aside from its card
    await pickAction(page, OPENED, selectionCopy.actions.setAside)

    // Gone from the pool, which counts one problem fewer
    await expect(cardOf(page, OPENED)).toHaveCount(0)
    await expect(problemCount(page, ON_OFFER_COUNT - 1)).toBeVisible()

    // The set-aside view, counting both problems now
    await page
      .getByRole('button', { name: selectionText('filters.setAside', { count: 2 }), exact: true })
      .click()

    // Showing the problem
    await expect(cardOf(page, OPENED)).toBeVisible()

    // Brought back from its card
    await pickAction(page, OPENED, selectionCopy.actions.bringBack)

    // Gone from the set-aside view
    await expect(cardOf(page, OPENED)).toHaveCount(0)

    // The pool again
    await page
      .getByRole('button', { name: selectionText('filters.setAside', { count: 1 }), exact: true })
      .click()

    // Showing the problem where it was
    await expect(cardOf(page, OPENED)).toBeVisible()

    // Set aside, then brought back, each sent once
    await expect
      .poll(() => writes().map((write) => [write.method(), write.url(), write.postDataJSON()]))
      .toEqual([
        ['PUT', `${SELECTION_ENDPOINT}/proposals/${OPENED.id}/set-aside`, { isSetAside: true }],
        ['PUT', `${SELECTION_ENDPOINT}/proposals/${OPENED.id}/set-aside`, { isSetAside: false }],
      ])
  })

  test('offers a problem a round has taken only its categories', async ({ page }) => {
    // A reviewer whose finalized board's round has taken a problem
    await stubSelection(page, 'selection')

    // The problem's own page
    await page.goto(`${SELECTION_PATH}?problem=${USED.id}`)

    // Once it has loaded
    await expect(headingOf(page, USED)).toBeVisible({ timeout: SETTLE_TIMEOUT_MS })

    // Its menu
    await actionsButton(page, USED).click()

    // Every category to recommend it for
    await expect(page.getByRole('menuitemcheckbox')).toHaveCount(3)

    // And no way to set it aside or delete it
    await expect(page.getByRole('menuitem')).toHaveCount(0)
  })
})

test.describe('deleting a problem', () => {
  test('asks first, naming what goes with the problem, and leaves it be on Cancel', async ({
    page,
  }) => {
    // A reviewer whose problem carries two conversations and a comment
    await stubSelection(page, 'selection')

    // Every write the page sends to a problem
    const writes = recordWrites(page, isProposalWrite)

    // The pool
    await openPool(page)

    // A delete asked for from the problem's card
    await pickAction(page, OPENED, messages.ui.actions.delete)

    // What goes with the problem, each kind counted, run together as the page's language lists things
    const attached = new Intl.ListFormat('en').format([
      pluralText('conversations', { count: 2 }),
      selectionText('filing.comments', { count: 1 }),
    ])

    // Named in the question
    await expect(deleteQuestion(page, OPENED)).toContainText(
      selectionText('actions.deleteMessageWithAttached', { attached })
    )

    // Turned down
    await deleteQuestion(page, OPENED)
      .getByRole('button', { name: messages.ui.actions.cancel })
      .click()

    // The problem still in the pool
    await expect(cardOf(page, OPENED)).toBeVisible()

    // The focus back on its menu's button
    await expect(actionsButton(cardOf(page, OPENED), OPENED)).toBeFocused()

    // And nothing sent
    expect(writes()).toEqual([])
  })

  test('deletes a problem from its card, emptying every slot it stood in', async ({ page }) => {
    // A reviewer whose first draft holds the problem in its first elementary slot
    await stubSelection(page, 'selection')

    // Every write the page sends to a problem
    const writes = recordWrites(page, isProposalWrite)

    // The pool
    await openPool(page)

    // A delete asked for from the problem's card
    await pickAction(page, FIRST, messages.ui.actions.delete)

    // The question, which names nothing going with it
    await expect(deleteQuestion(page, FIRST)).toContainText(selectionCopy.actions.deleteMessage)

    // The answer to the read after the delete
    const readAfterWrite = page.waitForResponse(SELECTION_ENDPOINT)

    // Answered with Delete
    await deleteQuestion(page, FIRST)
      .getByRole('button', { name: messages.ui.actions.delete })
      .click()

    // The problem gone from the pool
    await expect(cardOf(page, FIRST)).toHaveCount(0)

    // And its slot standing empty
    await expect(slotOf(page, 'E1')).toContainText(selectionCopy.board.empty)

    // Once the read has landed
    await readAfterWrite

    // Sent once, as a delete of that problem
    expect(writes().map((write) => [write.method(), write.url()])).toEqual([
      ['DELETE', `${SELECTION_ENDPOINT}/proposals/${FIRST.id}`],
    ])
  })

  test('deletes a problem from its own page, stepping back to the pool it was opened from', async ({
    page,
  }) => {
    // A reviewer with a problem on offer
    await stubSelection(page, 'selection')

    // The pool
    await openPool(page)

    // The problem opened from the pool
    await cardOf(page, OPENED).getByRole('link', { name: OPENED.title }).click()

    // Its page
    await expect(headingOf(page, OPENED)).toBeVisible()

    // A delete asked for there
    await pickAction(page, OPENED, messages.ui.actions.delete)

    // Answered with Delete
    await deleteQuestion(page, OPENED)
      .getByRole('button', { name: messages.ui.actions.delete })
      .click()

    // The pool back, without the problem
    await expect(problemCount(page, ON_OFFER_COUNT - 1)).toBeVisible()
    await expect(cardOf(page, OPENED)).toHaveCount(0)

    // Its address naming no problem
    await expect(page).not.toHaveURL(/[?&]problem=/)

    // The focus on the count line, the problem's link gone with it
    await expect(problemCount(page, ON_OFFER_COUNT - 1)).toBeFocused()

    // A step forward
    await page.goForward()

    // Onto the gone problem's step, so the delete stepped back to the pool's step right before it
    await expect(page).toHaveURL(new RegExp(`[?&]problem=${OPENED.id}`))
  })

  test('deletes a problem reached by a link, the pool taking its step', async ({ page }) => {
    // A reviewer with a problem on offer
    await stubSelection(page, 'selection')

    // The problem, opened cold from a link
    await page.goto(OPENED_ADDRESS)

    // Its page
    await expect(headingOf(page, OPENED)).toBeVisible({ timeout: SETTLE_TIMEOUT_MS })

    // A delete asked for there
    await pickAction(page, OPENED, messages.ui.actions.delete)

    // Answered with Delete
    await deleteQuestion(page, OPENED)
      .getByRole('button', { name: messages.ui.actions.delete })
      .click()

    // The pool in its place, still on the selection, without the problem
    await expect(problemCount(page, ON_OFFER_COUNT - 1)).toBeVisible()
    await expect(cardOf(page, OPENED)).toHaveCount(0)

    // Its address naming no problem
    await expect(page).not.toHaveURL(/[?&]problem=/)
  })

  test('deletes a problem stepped back to through history, the pool taking its step', async ({
    page,
  }) => {
    // A reviewer with a problem on offer
    await stubSelection(page, 'selection')

    // The problem, opened cold from a link
    await page.goto(OPENED_ADDRESS)

    // Its page
    await expect(headingOf(page, OPENED)).toBeVisible({ timeout: SETTLE_TIMEOUT_MS })

    // Back to the pool
    await page.getByRole('link', { name: selectionCopy.detail.backToPool }).click()

    // The same problem opened from the pool
    await cardOf(page, OPENED).getByRole('link', { name: OPENED.title }).click()

    // Its page again
    await expect(headingOf(page, OPENED)).toBeVisible()

    // A step back, onto the pool
    await page.goBack()

    // Another, onto the step the link opened, which has no pool's step before it
    await page.goBack()

    // Its page from the link
    await expect(headingOf(page, OPENED)).toBeVisible()

    // A delete asked for there
    await pickAction(page, OPENED, messages.ui.actions.delete)

    // Answered with Delete
    await deleteQuestion(page, OPENED)
      .getByRole('button', { name: messages.ui.actions.delete })
      .click()

    // The pool in its place, still on the selection, without the problem
    await expect(problemCount(page, ON_OFFER_COUNT - 1)).toBeVisible()
    await expect(cardOf(page, OPENED)).toHaveCount(0)

    // Its address naming no problem
    await expect(page).not.toHaveURL(/[?&]problem=/)
  })
})

test.describe('finalizing a board', () => {
  test('lists what stands between a draft and its rounds, and offers Finalize only once nothing does', async ({
    page,
  }) => {
    // A reviewer whose first draft has empty slots and a problem written in English alone
    const answerSelectionWith = await stubSelection(page, 'selection')

    // The pool
    await openPool(page)

    // How many slots stand empty
    await expect(boardPanel(page)).toContainText(selectionText('board.emptyCount', { count: 7 }))

    // And the problem a round would refuse, a link to it beside what it lacks
    await expect(
      boardPanel(page)
        .getByRole('listitem')
        .filter({ has: page.getByRole('link', { name: `#${FIRST.number}`, exact: true }) })
    ).toContainText(selectionText('board.needsLanguages', { languages: 'SK, CS, EN' }))

    // Finalize, unavailable
    await expect(finalizeButton(page)).toHaveAttribute('aria-disabled', 'true')

    // Finalize, focused all the same, as the keyboard still reaches it
    await finalizeButton(page).focus()

    // And Enter pressed on it
    await page.keyboard.press('Enter')

    // A task gone by, in which a dialog the press opened would have mounted
    await page.evaluate(() => new Promise((resolve) => setTimeout(resolve)))

    // Opening nothing, the focus still on the button
    await expect(finalizeDialog(page, DRAFT_BOARD)).toHaveCount(0)
    await expect(finalizeButton(page)).toBeFocused()

    // A later read, with a full board of ready problems
    answerSelectionWith('fullDraft')

    // The pool, read again
    await openPool(page)

    // Saying nothing stands in its way
    await expect(boardPanel(page)).toContainText(selectionCopy.board.ready)

    // And offering Finalize
    await expect(finalizeButton(page)).not.toHaveAttribute('aria-disabled', 'true')
  })

  test('sends the board into the cycle picked, which takes its problems out of the pool and off every other draft', async ({
    page,
  }) => {
    // A reviewer whose first draft is full of ready problems, and fits two cycles
    await stubSelection(page, 'winterOnOffer')

    // Every finalization the page sends
    const writes = recordWrites(page, isFinalization)

    // The pool
    await openPool(page)

    // The finalize dialog
    const dialog = await openFinalize(page, FULL_DRAFT)

    // Offering the cycles whose rounds the papers fit, the sooner picked, and the one they don't fit, with why
    await expect(cycleOption(dialog, NOVEMBER)).toBeChecked()
    await expect(cycleOption(dialog, WINTER)).toBeEnabled()
    await expect(cycleOption(dialog, DECEMBER)).toBeDisabled()
    await expect(dialog).toContainText(
      [
        selectionText('finalize.wrongSize', { paper: 'Elementary', slots: 1, count: 3 }),
        selectionText('finalize.noPaper', { category: categoryCopy.intermediate }),
        selectionText('finalize.noPaper', { category: categoryCopy.advanced }),
      ].join('; ')
    )

    // The later one, picked
    await cycleOption(dialog, WINTER).check()

    // Sent into Winter
    await confirmFinalize(dialog)

    // The board as Winter's rounds take it
    const finalized: Board = {
      ...FULL_DRAFT,
      finalization: { cycleName: WINTER.name, opensAt: WINTER.opensAt },
    }

    // The board in its rounds
    await expect(statusLine(page, finalized)).toBeVisible()

    // The dialog gone, the focus on the line saying where the board went
    await expect(finalizeDialog(page, FULL_DRAFT)).toHaveCount(0)
    await expect(statusLine(page, finalized)).toBeFocused()

    // And no way to finalize it again
    await expect(finalizeButton(page)).toHaveCount(0)

    // Sent once, naming the cycle picked
    expect(writes().map((write) => [write.method(), write.url(), write.postDataJSON()])).toEqual([
      [
        'POST',
        `${SELECTION_ENDPOINT}/boards/${FULL_DRAFT.id}/finalization`,
        { cycleId: WINTER.id },
      ],
    ])

    // The board's problem gone from the pool
    await expect(cardOf(page, READY)).toHaveCount(0)
    await expect(problemCount(page, ON_OFFER_COUNT - 1)).toBeVisible()

    // The later draft, on screen
    await pickBoard(page, FULL_DRAFT, LATER_DRAFT)

    // Its slot that held the problem standing empty
    await expect(slotOf(page, 'E1')).toContainText(selectionCopy.board.empty)
  })

  test('keeps the dialog open while the finalize is out, whatever the reader presses', async ({
    page,
  }) => {
    // A reviewer whose first draft is full of ready problems
    await stubSelection(page, 'fullDraft')

    // The gate the backend's answer to the finalize waits at
    const gate = createAnswerGate()

    // Every finalization held at it, then answered by the fake behind
    await page.route(isFinalization, async (route) => {
      // Waiting until the gate is open
      await gate.passed()

      // Then answered
      await route.fallback()
    })

    // The pool
    await openPool(page)

    // The finalize dialog
    const dialog = await openFinalize(page, FULL_DRAFT)

    // The answer held from here
    const release = gate.hold()

    // And every read after the finalize
    const releaseReads = await holdReads(page)

    // Sent into the cycle picked
    await confirmFinalize(dialog)

    // Its Cancel unavailable while the finalize is out, and the cycles fixed as picked
    await expect(dialog.getByRole('button', { name: messages.ui.actions.cancel })).toBeDisabled()
    await expect(cycleOption(dialog, NOVEMBER)).toBeDisabled()

    // Escape pressed
    await page.keyboard.press('Escape')

    // The dialog still open
    await expect(dialog.getByRole('button', { name: messages.ui.actions.cancel })).toBeVisible()

    // The answer to come
    const answered = page.waitForResponse((response) => isFinalization(new URL(response.url())))

    // The answer let through
    release()

    // Once the answer has landed
    await answered

    // A moment gone by, in which a dialog closing on the answer alone would have closed
    await page.evaluate(() => new Promise((resolve) => setTimeout(resolve, 100)))

    // The dialog still open, the read after the finalize still out
    await expect(dialog.getByRole('button', { name: messages.ui.actions.cancel })).toBeDisabled()

    // The read let through
    releaseReads()

    // The dialog closed once the read has landed too
    await expect(finalizeDialog(page, FULL_DRAFT)).toHaveCount(0)

    // And the board in its rounds
    await expect(statusLine(page, FULL_DRAFT_FINALIZED)).toBeVisible()
  })
})

test.describe('a finalize the backend refuses', () => {
  test('closes on a problem that lost a language meanwhile, which the board then names', async ({
    page,
  }) => {
    // A reviewer whose first draft is full of ready problems
    const answerSelectionWith = await stubSelection(page, 'fullDraft')

    // Every notice the page raises
    const notices = await recordNotices(page)

    // The pool
    await openPool(page)

    // The ready problem's Czech solution taken away meanwhile, which the page has not read
    answerSelectionWith('fullDraftIncomplete')

    // The finalize dialog
    const dialog = await openFinalize(page, FULL_DRAFT)

    // Sent into the cycle picked all the same
    await confirmFinalize(dialog)

    // Refused, the reader told why
    await expect.poll(notices).toEqual([refusalCopy.SelectionProblemIncomplete])

    // The dialog closed
    await expect(finalizeDialog(page, FULL_DRAFT)).toHaveCount(0)

    // The board naming what the problem lacks
    await expect(boardPanel(page)).toContainText(
      selectionText('board.needsLanguages', { languages: 'CS' })
    )

    // Its Finalize unavailable, the focus back on it
    await expect(finalizeButton(page)).toHaveAttribute('aria-disabled', 'true')
    await expect(finalizeButton(page)).toBeFocused()

    // And no other notice raised
    expect(notices()).toEqual([refusalCopy.SelectionProblemIncomplete])
  })

  test('closes on rounds filled meanwhile, which then leave the cycles on offer', async ({
    page,
  }) => {
    // A reviewer whose first draft is full of ready problems
    const answerSelectionWith = await stubSelection(page, 'fullDraft')

    // Every notice the page raises
    const notices = await recordNotices(page)

    // The pool
    await openPool(page)

    // The cycle the board fits filled by an import meanwhile, which the page has not read
    answerSelectionWith('novemberFilled')

    // The finalize dialog
    const firstDialog = await openFinalize(page, FULL_DRAFT)

    // Sent into November all the same
    await confirmFinalize(firstDialog)

    // Refused, the reader told why
    await expect.poll(notices).toEqual([refusalCopy.SelectionFinalizeBlocked])

    // The dialog closed
    await expect(finalizeDialog(page, FULL_DRAFT)).toHaveCount(0)

    // The finalize dialog, opened again
    const dialog = await openFinalize(page, FULL_DRAFT)

    // Offering only the cycle the papers don't fit
    await expect(dialog.getByRole('radio')).toHaveCount(1)
    await expect(cycleOption(dialog, DECEMBER)).toBeDisabled()

    // With nothing to send the board into
    await expect(
      dialog.getByRole('button', { name: selectionCopy.finalize.confirm })
    ).toBeDisabled()

    // And no other notice raised
    expect(notices()).toEqual([refusalCopy.SelectionFinalizeBlocked])
  })

  test('closes on a board another reviewer finalized meanwhile, the focus going to the line saying where it went', async ({
    page,
  }) => {
    // A reviewer whose first draft is full of ready problems
    const answerSelectionWith = await stubSelection(page, 'fullDraft')

    // Every notice the page raises
    const notices = await recordNotices(page)

    // The pool
    await openPool(page)

    // The finalize dialog
    const dialog = await openFinalize(page, FULL_DRAFT)

    // Another reviewer finalizing the board meanwhile, which the page has not read
    answerSelectionWith('fullDraftFinalized')

    // Sent into the cycle picked all the same
    await confirmFinalize(dialog)

    // Refused, the reader told why
    await expect.poll(notices).toEqual([refusalCopy.SelectionBoardFinalized])

    // The board in its rounds as the other reviewer left it
    await expect(statusLine(page, FULL_DRAFT_FINALIZED)).toBeVisible()

    // The dialog gone, the focus on the line saying where the board went
    await expect(finalizeDialog(page, FULL_DRAFT)).toHaveCount(0)
    await expect(statusLine(page, FULL_DRAFT_FINALIZED)).toBeFocused()

    // And no other notice raised
    expect(notices()).toEqual([refusalCopy.SelectionBoardFinalized])
  })
})

test.describe("a problem's action the backend refuses", () => {
  test('refuses setting aside a problem another reviewer deleted meanwhile, then shows it gone', async ({
    page,
  }) => {
    // A reviewer with a problem on offer
    const answerSelectionWith = await stubSelection(page, 'selection')

    // Every notice the page raises
    const notices = await recordNotices(page)

    // The pool
    await openPool(page)

    // Another reviewer deleting the problem, which the page has not read
    answerSelectionWith('openedDeleted')

    // Set aside all the same
    await pickAction(page, OPENED, selectionCopy.actions.setAside)

    // Refused, the reader told why
    await expect.poll(notices).toEqual([refusalCopy.SelectionTargetNotFound])

    // And the selection read again, without the problem
    await expect(problemCount(page, ON_OFFER_COUNT - 1)).toBeVisible()
    await expect(cardOf(page, OPENED)).toHaveCount(0)

    // With no other notice raised
    expect(notices()).toEqual([refusalCopy.SelectionTargetNotFound])
  })

  test('refuses deleting a problem a round took meanwhile', async ({ page }) => {
    // A reviewer whose first draft is full of ready problems
    const answerSelectionWith = await stubSelection(page, 'fullDraft')

    // Every notice the page raises
    const notices = await recordNotices(page)

    // The pool
    await openPool(page)

    // Another reviewer finalizing the board, whose round takes the problem, none of which the page has read
    answerSelectionWith('fullDraftFinalized')

    // A delete asked for from the problem's card all the same
    await pickAction(page, READY, messages.ui.actions.delete)

    // Answered with Delete
    await deleteQuestion(page, READY)
      .getByRole('button', { name: messages.ui.actions.delete })
      .click()

    // Refused, the reader told why
    await expect.poll(notices).toEqual([refusalCopy.SelectionProposalUsed])

    // And the selection read again, the problem in its round and out of the pool
    await expect(statusLine(page, FULL_DRAFT_FINALIZED)).toBeVisible()
    await expect(cardOf(page, READY)).toHaveCount(0)

    // With no other notice raised
    expect(notices()).toEqual([refusalCopy.SelectionProposalUsed])
  })
})
