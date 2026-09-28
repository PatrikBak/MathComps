import type { Locator, Page } from '@playwright/test'

import { ROUTES } from '@/i18n/i18n'

import messages from '../messages/en.json'
import { LIST_PATH } from './support/competitions'
import { installGradingBackend } from './support/grading-backend'
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
  await expect(dialog.getByRole('group', { name: copy.panel.mark })).toBeVisible({
    timeout: SETTLE_TIMEOUT_MS,
  })

  // The dialog, ready to grade in
  return dialog
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

    // Every way into grading on it
    const links = page.getByRole('link', { name: messages.competitions.grade })

    // Once the page has drawn them, since reading where they lead waits for nothing
    await expect(links.first()).toBeVisible({ timeout: SETTLE_TIMEOUT_MS })

    // Where each one leads
    const targets = await links.evaluateAll((anchors) =>
      anchors.map((anchor) => anchor.getAttribute('href'))
    )

    // On a closed round and on one taking entries, and not on the practice or an upcoming one
    expect(targets).toContain('/en/admin/grading/past-21')
    expect(targets).toContain('/en/admin/grading/open')
    expect(targets).not.toContain('/en/admin/grading/practice')
    expect(targets).not.toContain('/en/admin/grading/upcoming')

    // Followed
    await page.locator('a[href="/en/admin/grading/past-21"]').click()

    // Onto that round's board
    await expect(page.getByRole('heading', { name: copy.title })).toBeVisible({
      timeout: SETTLE_TIMEOUT_MS,
    })
    await expect(page.getByText('past-21', { exact: true })).toBeVisible()
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

    // Sorted by total
    await page.getByRole('button', { name: copy.grid.total }).click()

    // From the best, the student with nothing graded last
    await expect(names).toHaveText(['Bruno', 'Ada', 'Cyril'])

    // The other competition
    await page.getByRole('button', { name: /^Intermediate/ }).click()

    // Its own students
    await expect(names).toHaveText(['Dora'])
  })

  test('reads a pair whole, and walks every pair with a conversation', async ({ page }) => {
    // A backend serving the test group's board
    await installGradingBackend(page, GROUP_SLUG)

    // Ada's first problem, the first pair on the walk
    const dialog = await openGrade(page, 'Ada', 1)

    // Who and what, and where it sits on the walk
    await expect(dialog.getByText('Ada', { exact: true })).toBeVisible()
    await expect(dialog.getByText('Elementary, problem 1')).toBeVisible()
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
      ['Bruno', 'Elementary, problem 1'],
      ['Cyril', 'Elementary, problem 1'],
      ['Ada', 'Elementary, problem 2'],
      ['Cyril', 'Elementary, problem 2'],
    ]

    // Each pair along the walk, one step at a time
    for (const [student, subtitle] of walk) {
      // One step along
      await page.keyboard.press('j')

      // Lands on the next pair
      await expect(dialog.getByText(student, { exact: true })).toBeVisible()
      await expect(dialog.getByText(subtitle)).toBeVisible()
    }

    // The end of the walk, with nothing past it
    await expect(dialog.getByText('5 of 5', { exact: true })).toBeVisible()
    await expect(dialog.getByRole('button', { name: NEXT, exact: true })).toBeDisabled()
  })
})

test.describe('a grade', () => {
  test('sends only what each click changes', async ({ page }) => {
    // A backend serving the test group's board
    const backend = await installGradingBackend(page, GROUP_SLUG)

    // Ada's first problem, which nobody has graded
    const dialog = await openGrade(page, 'Ada', 1)

    // Its controls
    const marks = dialog.getByRole('group', { name: copy.panel.mark })
    const help = dialog.getByRole('group', { name: copy.panel.help })
    const final = dialog.getByRole('checkbox', { name: copy.panel.final })

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
    const marks = dialog.getByRole('group', { name: copy.panel.mark })
    const help = dialog.getByRole('group', { name: copy.panel.help })

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
    const comment = dialog.getByRole('textbox', { name: copy.panel.comment })

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
    const comment = dialog.getByRole('textbox', { name: copy.panel.comment })

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
