import type { Locator, Page } from '@playwright/test'

import { ROUTES } from '@/i18n/i18n'

import messages from '../messages/en.json'
import { expectOnlyNotCounting } from './support/admin-conversation'
import { LIST_PATH, showRoundHolding } from './support/competitions'
import { GROUP_NAME, installGradingBackend } from './support/grading-backend'
import { installHostedBackend } from './support/hosted-backend'
import { expect, test } from './support/test'

/** The group whose board each test opens, except the one following the way in from a round's panel. */
const GROUP_SLUG = 'mc-test'

/** The test group's board, in English, which is the locale the assertions' copy is taken from. */
const BOARD_PATH = `/en${ROUTES.ADMIN_GRADING.replace('[slug]', GROUP_SLUG)}`

/** How long the fake backend has to answer before a wait is called a failure. */
const SETTLE_TIMEOUT_MS = 15_000

/** The grading copy, in English. */
const copy = messages.admin.grading

/** The copy of one grade, in English. */
const gradeCopy = messages.admin.grades

/** The name of the step forward through the pairs. */
const NEXT = messages.admin.conversation.next

/**
 * Finds the button of one student's grade on one problem.
 *
 * @param page - The page.
 * @param student - The student's name.
 * @param problemNumber - Which problem, by its place in the competition.
 *
 * @returns The cell's button.
 */
function cellOf(page: Page, student: string, problemNumber: number): Locator {
  // The student's row, whose cells run place, problems in order, then the sum
  const row = page.getByRole('row').filter({ has: page.getByRole('rowheader', { name: student }) })

  // The button in that problem's cell, past the place
  return row.getByRole('cell').nth(problemNumber).getByRole('button')
}

/**
 * Opens one student's grade on one problem from the test group's board.
 *
 * @param page - The page.
 * @param student - The student's name.
 * @param problemNumber - Which problem, by its place in the competition.
 *
 * @returns The dialog the grade opens in.
 */
async function openGrade(page: Page, student: string, problemNumber: number): Promise<Locator> {
  // The board
  await page.goto(BOARD_PATH)

  // The grade, opened from its cell
  await cellOf(page, student, problemNumber).click({ timeout: SETTLE_TIMEOUT_MS })

  // The dialog the grade opens in
  const dialog = page.getByRole('dialog')

  // Waited on until the grade's controls are up
  await expect(dialog.getByRole('group', { name: gradeCopy.panel.mark })).toBeVisible({
    timeout: SETTLE_TIMEOUT_MS,
  })

  // The dialog, ready to grade in
  return dialog
}

/**
 * Reads where the page's address stands, its path and query without the origin.
 *
 * @param page - The page.
 *
 * @returns The path and the query, the query with its question mark.
 */
function addressOf(page: Page): string {
  // The address as the page holds it
  const address = new URL(page.url())

  // Everything past the origin
  return `${address.pathname}${address.search}`
}

declare global {
  interface Window {
    /** Tells the test run that a dialog has reached the page. */
    reportDialog: () => void
  }
}

/**
 * Counts every dialog that reaches the page, however briefly.
 *
 * A dialog opened and closed again before an assertion is reached leaves the page looking as if it never
 * opened, so a check taken afterwards passes either way. Watching for them as they arrive is what tells a
 * link that opened nothing from one that opened a dialog and took it back down.
 *
 * @param page - The page to watch, before it loads anything.
 *
 * @returns How many dialogs have reached the page so far.
 */
async function countDialogs(page: Page): Promise<() => number> {
  // Every dialog that reached the page
  let dialogs = 0

  // The channel the page reports each one through
  await page.exposeFunction('reportDialog', () => {
    dialogs += 1
  })

  // Every document from the next one on, since the one under test is about to load
  await page.addInitScript(() => {
    // The dialogs already reported, so one that stays up counts once
    const reported = new WeakSet<Element>()

    // A function which reports every dialog on the page not reported yet
    const reportNewDialogs = () => {
      document.querySelectorAll('[role="dialog"]').forEach((dialog) => {
        // Already counted
        if (reported.has(dialog)) return

        // Remembered, so it counts once
        reported.add(dialog)

        // And counted
        window.reportDialog()
      })
    }

    // The document itself, whose root does not exist yet this early
    new MutationObserver(reportNewDialogs).observe(document, { childList: true, subtree: true })
  })

  // Hand back the count on each read
  return () => dialogs
}

test.describe('the way into grading', () => {
  test('leads from the open and closed rounds on the Mathilding page, and from no other', async ({
    page,
  }) => {
    // Rounds in every phase, the one closed three weeks back among them
    await installHostedBackend(page, 'ready')

    // A backend serving the board of the round closed three weeks back
    await installGradingBackend(page, 'past-21')

    // The Mathilding page
    await page.goto(LIST_PATH)

    // The way into grading on the round showing
    const gradeLink = page
      .getByRole('tabpanel')
      .getByRole('link', { name: messages.competitions.grade })

    // A round taking entries, brought into view
    await showRoundHolding(page, page.locator('[data-competition-slug="open-intermediate"]'))

    // Which leads into its grading
    await expect(gradeLink).toHaveAttribute('href', '/en/admin/grading/open')

    // A round still to come, brought into view
    await showRoundHolding(page, page.locator('[data-competition-slug="upcoming-intermediate"]'))

    // Which has nothing to grade yet
    await expect(gradeLink).toHaveCount(0)

    // Nor does the practice one, which is never graded
    await expect(page.locator('a[href="/en/admin/grading/practice"]')).toHaveCount(0)

    // The round closed three weeks back, brought into view
    await showRoundHolding(page, page.locator('[data-competition-slug="past-21-intermediate"]'))

    // Which leads into its grading too
    await expect(gradeLink).toHaveAttribute('href', '/en/admin/grading/past-21')

    // Followed
    await gradeLink.click()

    // Onto that round's board, named the way the Mathilding page names it, with the days it took entries
    await expect(page.getByRole('heading', { name: copy.title })).toBeVisible({
      timeout: SETTLE_TIMEOUT_MS,
    })
    await expect(page.getByText(new RegExp(`^${GROUP_NAME}, .+ – .+$`))).toBeVisible()
    await expect(page.getByRole('rowheader', { name: 'Ada' })).toBeVisible()
  })
})

test.describe('the grading board', () => {
  test('orders the students by total, and switches between competitions', async ({ page }) => {
    // A backend serving the test group's board
    await installGradingBackend(page, GROUP_SLUG)

    // The board, opened
    await page.goto(BOARD_PATH)

    // Every student's name, top to bottom
    const names = page.getByRole('rowheader')

    // By name to begin with
    await expect(names).toHaveText(['Ada', 'Bruno', 'Cyril'], { timeout: SETTLE_TIMEOUT_MS })

    // Five entries by four students, Ada having entered both, counted once
    await expect(page.getByText('4 students', { exact: true })).toBeVisible()

    // Sorted by total
    await page.getByRole('button', { name: copy.grid.total }).click()

    // From the best, the student with nothing graded last
    await expect(names).toHaveText(['Bruno', 'Ada', 'Cyril'])

    // The other competition
    await page.getByRole('button', { name: /^Intermediate/ }).click()

    // Its own students
    await expect(names).toHaveText(['Ada', 'Dora'])
  })

  test('reads a pair whole, and walks every pair with a conversation', async ({ page }) => {
    // A backend serving the test group's board
    await installGradingBackend(page, GROUP_SLUG)

    // Ada's first problem, the first pair on the walk
    const dialog = await openGrade(page, 'Ada', 1)

    // Who and what, and where it sits on the walk
    await expect(dialog.getByText('Ada', { exact: true })).toBeVisible()
    await expect(dialog.getByText('Problem 1', { exact: true })).toBeVisible()
    await expect(dialog.getByText('1 of 5', { exact: true })).toBeVisible()

    // What she said about her own solution
    await expect(dialog.getByText('I think it is complete.')).toBeVisible()

    // Her first conversation, open to begin with
    await expect(dialog.getByText('Answer 1 by ada on p1.')).toBeVisible()

    // Her second, picked
    await dialog.getByRole('button', { name: /^Conversation 2/ }).click()

    // Which shows her answer in it
    await expect(dialog.getByText('Answer 2 by ada on p1.')).toBeVisible()

    // Down the first problem, then the second, passing Bruno, who never spoke about it
    const walk = [
      ['Bruno', 'Problem 1'],
      ['Cyril', 'Problem 1'],
      ['Ada', 'Problem 2'],
      ['Cyril', 'Problem 2'],
    ]

    // Each pair along the walk, one step at a time
    for (const [student, problem] of walk) {
      // One step along
      await page.keyboard.press('j')

      // Lands on the next pair
      await expect(dialog.getByText(student, { exact: true })).toBeVisible()
      await expect(dialog.getByText(problem, { exact: true })).toBeVisible()
    }

    // The end of the walk, with nothing past it
    await expect(dialog.getByText('5 of 5', { exact: true })).toBeVisible()
    await expect(dialog.getByRole('button', { name: NEXT, exact: true })).toBeDisabled()
  })

  test('marks a conversation read by opening it', async ({ page }) => {
    // A backend serving the test group's board
    const backend = await installGradingBackend(page, GROUP_SLUG)

    // Ada's first problem, open on her first conversation
    const dialog = await openGrade(page, 'Ada', 1)

    // Recorded as read
    await expect.poll(() => backend.readMarks()).toEqual(['ada-p1-1'])

    // Which the toggle offers to take back
    await expect(
      dialog.getByRole('button', { name: messages.admin.conversation.markUnread, exact: true })
    ).toBeVisible()
  })

  test('lists a conversation started after the hand-in, marked as not counting', async ({
    page,
  }) => {
    // A backend serving the test group's board
    await installGradingBackend(page, GROUP_SLUG)

    // Ada's first problem, whose third conversation she started after handing in
    const dialog = await openGrade(page, 'Ada', 1)

    // That conversation, picked
    await dialog.getByRole('button', { name: /^Conversation 3/ }).click()

    // Which shows her answer in it
    await expect(dialog.getByText('Answer 3 by ada on p1.')).toBeVisible()

    // Listed with the two that count, and marked as the one that doesn't
    await expectOnlyNotCounting(dialog, 3, 3)
  })

  test('offers the conversation with the student beside his conversation', async ({ page }) => {
    // A backend serving the test group's board
    await installGradingBackend(page, GROUP_SLUG)

    // Cyril's first problem, which he spoke about once
    const dialog = await openGrade(page, 'Cyril', 1)

    // The conversation with him, picked among the side tabs
    await dialog
      .getByRole('tab', { name: messages.admin.conversation.tabs.feedback, exact: true })
      .click()

    // The thread saying when the student gets to read it
    await expect(dialog.getByText(gradeCopy.studentSeesOnceFinal)).toBeVisible()

    // His conversation with Mathilda still on screen beside the thread
    await expect(dialog.getByText('Answer 1 by cyril on p1.')).toBeVisible()
  })

  test('hands focus back to the cell of the pair the walk ended on', async ({ page }) => {
    // A backend serving the test group's board
    await installGradingBackend(page, GROUP_SLUG)

    // Ada's first problem, the first pair on the walk
    const dialog = await openGrade(page, 'Ada', 1)

    // One step along the walk
    await page.keyboard.press('j')

    // Onto Bruno
    await expect(dialog.getByText('Bruno', { exact: true })).toBeVisible()

    // Another step along the walk
    await page.keyboard.press('j')

    // Onto Cyril
    await expect(dialog.getByText('Cyril', { exact: true })).toBeVisible()

    // The dialog closed
    await page.keyboard.press('Escape')

    // Focus on Cyril's cell rather than on Ada's, which was the one clicked
    await expect(cellOf(page, 'Cyril', 1)).toBeFocused()
  })
})

test.describe("the board's address", () => {
  test('opens on the category and the grade a link names', async ({ page }) => {
    // A backend serving the test group's board
    await installGradingBackend(page, GROUP_SLUG)

    // A link to Dora's grade, on the competition that isn't first
    await page.goto(`${BOARD_PATH}?category=intermediate&student=dora&problem=q1`)

    // Which opens her grade, on her first conversation
    const dialog = page.getByRole('dialog')
    await expect(dialog.getByText('Answer 1 by dora on q1.')).toBeVisible({
      timeout: SETTLE_TIMEOUT_MS,
    })
    await expect(dialog.getByText('Dora', { exact: true })).toBeVisible()

    // The dialog closed
    await page.keyboard.press('Escape')

    // Onto the competition the link named
    await expect(page.getByRole('button', { name: /^Intermediate/ })).toHaveAttribute(
      'aria-pressed',
      'true'
    )
    await expect(page.getByRole('rowheader')).toHaveText(['Ada', 'Dora'])

    // Whose address now names the competition alone
    await expect.poll(() => addressOf(page)).toBe(`${BOARD_PATH}?category=intermediate`)
  })

  test('says what is on screen, without adding to the history', async ({ page }) => {
    // A backend serving the test group's board
    await installGradingBackend(page, GROUP_SLUG)

    // Ada's first problem, opened from its cell
    const dialog = await openGrade(page, 'Ada', 1)

    // How many entries the history holds with the board open
    const historyLength = await page.evaluate(() => history.length)

    // Named by the student and the problem, the competition being the first
    await expect.poll(() => addressOf(page)).toBe(`${BOARD_PATH}?student=ada&problem=p1`)

    // Her second conversation, picked
    await dialog.getByRole('button', { name: /^Conversation 2/ }).click()

    // Which shows her answer in it
    await expect(dialog.getByText('Answer 2 by ada on p1.')).toBeVisible()

    // One step along the walk
    await page.keyboard.press('j')

    // Onto Bruno
    await expect(dialog.getByText('Bruno', { exact: true })).toBeVisible()
    await expect.poll(() => addressOf(page)).toBe(`${BOARD_PATH}?student=bruno&problem=p1`)

    // And back
    await page.keyboard.press('k')

    // Onto Ada's first conversation, where every grade opens, whichever was showing when she was left
    await expect(dialog.getByText('Answer 1 by ada on p1.')).toBeVisible()
    await expect.poll(() => addressOf(page)).toBe(`${BOARD_PATH}?student=ada&problem=p1`)

    // The dialog closed
    await page.keyboard.press('Escape')

    // Which leaves the bare board
    await expect.poll(() => addressOf(page)).toBe(BOARD_PATH)

    // The other competition
    await page.getByRole('button', { name: /^Intermediate/ }).click()

    // Named
    await expect.poll(() => addressOf(page)).toBe(`${BOARD_PATH}?category=intermediate`)

    // Every change written over the one entry rather than onto a new one
    expect(await page.evaluate(() => history.length)).toBe(historyLength)

    // Reloaded
    await page.reload()

    // Back on the competition it was showing
    await expect(page.getByRole('button', { name: /^Intermediate/ })).toHaveAttribute(
      'aria-pressed',
      'true',
      { timeout: SETTLE_TIMEOUT_MS }
    )
  })

  test('falls back to the first competition where a link names one the group does not run', async ({
    page,
  }) => {
    // A backend serving the test group's board
    await installGradingBackend(page, GROUP_SLUG)

    // A link to Ada's first problem naming a competition the group doesn't run
    await page.goto(`${BOARD_PATH}?category=advanced&student=ada&problem=p1`)

    // Which opens her grade
    const dialog = page.getByRole('dialog')
    await expect(dialog.getByText('Answer 1 by ada on p1.')).toBeVisible({
      timeout: SETTLE_TIMEOUT_MS,
    })

    // Whose address drops the competition, naming what is on screen
    await expect.poll(() => addressOf(page)).toBe(`${BOARD_PATH}?student=ada&problem=p1`)

    // The dialog closed
    await page.keyboard.press('Escape')

    // Over the first competition
    await expect(page.getByRole('button', { name: /^Elementary/ })).toHaveAttribute(
      'aria-pressed',
      'true'
    )
  })

  // Links naming a grade the board on screen doesn't walk, and the address each leaves once the board says so
  const unwalked = [
    ['a pair nobody spoke about', 'student=bruno&problem=p2', ''],
    ['a student nobody is', 'student=nobody&problem=p1', ''],
    [
      'a pair on another competition',
      'category=intermediate&student=ada&problem=p1',
      '?category=intermediate',
    ],
  ] as const

  // One test per link
  for (const [label, query, settled] of unwalked) {
    test(`opens nothing for ${label}`, async ({ page }) => {
      // Every dialog the page puts up, from the first document on
      const dialogs = await countDialogs(page)

      // A backend serving the test group's board
      await installGradingBackend(page, GROUP_SLUG)

      // The link
      await page.goto(`${BOARD_PATH}?${query}`)

      // The board, once it has arrived
      await expect(page.getByRole('rowheader').first()).toBeVisible({ timeout: SETTLE_TIMEOUT_MS })

      // Its address, the grade dropped
      await expect.poll(() => addressOf(page)).toBe(`${BOARD_PATH}${settled}`)

      // And no dialog, not even for a moment
      expect(dialogs()).toBe(0)
    })
  }
})

test.describe('a grade', () => {
  test('sends only what each click changes', async ({ page }) => {
    // A backend serving the test group's board
    const backend = await installGradingBackend(page, GROUP_SLUG)

    // Ada's first problem, which nobody has graded
    const dialog = await openGrade(page, 'Ada', 1)

    // Its controls
    const marks = dialog.getByRole('group', { name: gradeCopy.panel.mark })
    const help = dialog.getByRole('group', { name: gradeCopy.panel.help })
    const final = dialog.getByRole('checkbox', { name: gradeCopy.panel.final })

    // Nothing to be final about before there is a mark
    await expect(final).toBeDisabled()

    // A 5
    await marks.getByRole('button', { name: '5', exact: true }).click()

    // 3 of it from Mathilda
    await help.getByRole('button', { name: '3', exact: true }).click()

    // Lowered under the help
    await marks.getByRole('button', { name: '2', exact: true }).click()

    // Which pulls the help down with it
    await expect(help.getByRole('button', { name: '2', exact: true })).toHaveAttribute(
      'aria-pressed',
      'true'
    )

    // Settled
    await final.click()

    // Which the checkbox shows
    await expect(final).toBeChecked()

    // The dialog closed
    await page.keyboard.press('Escape')

    // Which the board shows as 2 less half of 2
    await expect(cellOf(page, 'Ada', 1)).toHaveText('1')

    // Opened again
    await cellOf(page, 'Ada', 1).click()

    // The mark taken back by clicking it again, with whatever rested on it
    await marks.getByRole('button', { name: '2', exact: true }).click()

    // Which leaves nothing to be final about
    await expect(final).not.toBeChecked()
    await expect(final).toBeDisabled()

    // Every click sent exactly what it moved
    await expect
      .poll(() => backend.changes())
      .toEqual([
        { pair: 'ada|p1', change: { mark: { value: 5 } } },
        { pair: 'ada|p1', change: { help: 3 } },
        { pair: 'ada|p1', change: { mark: { value: 2 }, help: 2 } },
        { pair: 'ada|p1', change: { isFinal: true } },
        { pair: 'ada|p1', change: { mark: { value: null }, help: 0, isFinal: false } },
      ])
  })

  test('shows a change at once, and puts back what the server holds when it refuses', async ({
    page,
  }) => {
    // A backend refusing any help of 4
    const backend = await installGradingBackend(page, GROUP_SLUG, {
      refuses: (change) => change.help === 4,
    })

    // Ada's first problem
    const dialog = await openGrade(page, 'Ada', 1)

    // Its mark and help
    const marks = dialog.getByRole('group', { name: gradeCopy.panel.mark })
    const help = dialog.getByRole('group', { name: gradeCopy.panel.help })

    // A 5
    await marks.getByRole('button', { name: '5', exact: true }).click()

    // Which the server takes before anything is held
    await expect.poll(() => backend.changes().length).toBe(1)

    // The server holds its answer to what comes next
    const release = backend.hold()

    // 4 of it from Mathilda
    await help.getByRole('button', { name: '4', exact: true }).click()

    // On screen while the server still thinks it over
    await expect(help.getByRole('button', { name: '4', exact: true })).toHaveAttribute(
      'aria-pressed',
      'true'
    )

    // Refused
    release()

    // Said so, the help back at what the server holds, and the mark left where it landed
    await expect(page.getByText(messages.apiErrors.HostedGradeValue)).toBeVisible()
    await expect(help.getByRole('button', { name: '0', exact: true })).toHaveAttribute(
      'aria-pressed',
      'true'
    )
    await expect(marks.getByRole('button', { name: '5', exact: true })).toHaveAttribute(
      'aria-pressed',
      'true'
    )
  })

  test('saves its comment once the grader moves off it, and an untouched one never', async ({
    page,
  }) => {
    // A backend serving the test group's board
    const backend = await installGradingBackend(page, GROUP_SLUG)

    // Ada's first problem
    const dialog = await openGrade(page, 'Ada', 1)

    // The comment field
    const comment = dialog.getByRole('textbox', { name: gradeCopy.panel.comment })

    // Written, which sends nothing yet
    await comment.fill('Check the case n = 1.')

    // Stepped on with the button, which leaves the field first and then the pair
    await dialog.getByRole('button', { name: NEXT, exact: true }).click()

    // Onto Bruno
    await expect(dialog.getByText('Bruno', { exact: true })).toBeVisible()

    // Bruno's comment left alone, and stepped on again
    await page.keyboard.press('j')

    // Onto Cyril
    await expect(dialog.getByText('Cyril', { exact: true })).toBeVisible()

    // Cyril's written
    await comment.fill('Nothing to grade yet.')

    // The dialog closed straight out of the field
    await comment.press('Escape')

    // And gone
    await expect(dialog).toBeHidden()

    // Each written comment arrived once, and the one left alone never did
    await expect
      .poll(() => backend.changes())
      .toEqual([
        { pair: 'ada|p1', change: { internalComment: 'Check the case n = 1.' } },
        { pair: 'cyril|p1', change: { internalComment: 'Nothing to grade yet.' } },
      ])
  })

  test('sends a refused comment again once the grader next moves off it', async ({ page }) => {
    // Whether the backend has turned a comment down yet
    let hasRefusedComment = false

    // A backend refusing the first comment it is sent and taking every other change
    const backend = await installGradingBackend(page, GROUP_SLUG, {
      refuses: (change) => {
        // Anything but a comment, and any comment after the first, is taken
        if (change.internalComment === undefined || hasRefusedComment) return false

        // Noted, so that no later comment is turned down
        hasRefusedComment = true

        // And this one refused
        return true
      },
    })

    // Ada's first problem
    const dialog = await openGrade(page, 'Ada', 1)

    // The comment field
    const comment = dialog.getByRole('textbox', { name: gradeCopy.panel.comment })

    // Written
    await comment.fill('Check the case n = 1.')

    // And left
    await comment.blur()

    // Which the server refuses
    await expect(page.getByText(messages.apiErrors.HostedGradeValue)).toBeVisible()

    // Entered and left again without a change
    await comment.focus()
    await comment.blur()

    // Which sends it a second time
    await expect
      .poll(() => backend.changes())
      .toEqual([
        { pair: 'ada|p1', change: { internalComment: 'Check the case n = 1.' } },
        { pair: 'ada|p1', change: { internalComment: 'Check the case n = 1.' } },
      ])
  })
})

test.describe('a column made final', () => {
  test('makes every mark in the column final once the grader confirms', async ({ page }) => {
    // A backend serving the test group's board
    const backend = await installGradingBackend(page, GROUP_SLUG)

    // The board
    await page.goto(BOARD_PATH)

    // The second problem's column, holding Ada's pre-graded mark beside Cyril's missing one
    const column = page.getByRole('button', { name: 'Make 1 mark on P2 final' })

    // Asked about
    await column.click({ timeout: SETTLE_TIMEOUT_MS })

    // The question
    const dialog = page.getByRole('dialog')

    // Saying who sees their mark and who is left out
    await expect(dialog).toContainText(
      '1 student will see their mark on P2. 1 student without a mark is left out.'
    )

    // Confirmed
    await dialog.getByRole('button', { name: copy.finalize.confirm }).click()

    // Ada's mark final
    await expect(cellOf(page, 'Ada', 2).getByLabel(copy.grid.final)).toBeVisible()

    // Nothing left in the column to make final
    await expect(column).toHaveCount(0)

    // Sent once, naming Ada alone
    await expect.poll(() => backend.finals()).toEqual([{ problemId: 'p2', userIds: ['ada'] }])
  })

  test('hands focus back to the column once it is made final', async ({ page }) => {
    // A backend serving the test group's board
    await installGradingBackend(page, GROUP_SLUG)

    // The board
    await page.goto(BOARD_PATH)

    // The second problem's column, reached from the keyboard
    await page
      .getByRole('button', { name: 'Make 1 mark on P2 final' })
      .focus({ timeout: SETTLE_TIMEOUT_MS })

    // Asked about
    await page.keyboard.press('Enter')

    // Confirmed from the keyboard
    await page.getByRole('dialog').getByRole('button', { name: copy.finalize.confirm }).focus()
    await page.keyboard.press('Enter')

    // Focus on the column's cell under the board, its button gone
    await expect(page.getByRole('row').last().getByRole('cell').nth(2)).toBeFocused()
  })

  test('shows the column final at once, and puts it back when the server fails', async ({
    page,
  }) => {
    // A backend failing every request to make grades final
    const backend = await installGradingBackend(page, GROUP_SLUG, { failsFinals: true })

    // The board
    await page.goto(BOARD_PATH)

    // The second problem's column
    const column = page.getByRole('button', { name: 'Make 1 mark on P2 final' })

    // Asked about
    await column.click({ timeout: SETTLE_TIMEOUT_MS })

    // The server holds its answer to what comes next
    const release = backend.hold()

    // Confirmed
    await page.getByRole('dialog').getByRole('button', { name: copy.finalize.confirm }).click()

    // Ada's mark final while the server still thinks it over
    await expect(cellOf(page, 'Ada', 2).getByLabel(copy.grid.final)).toBeVisible()

    // Failed
    release()

    // Said so, Ada's mark back to pre-graded, and the column's button back
    await expect(page.getByText(gradeCopy.finalizeFailed)).toBeVisible()
    await expect(cellOf(page, 'Ada', 2).getByLabel(copy.grid.final)).toHaveCount(0)
    await expect(column).toBeVisible()
  })
})
