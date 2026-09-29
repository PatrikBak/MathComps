import { ROUTES } from '@/i18n/i18n'

import messages from '../messages/en.json'
import {
  expectOnlyNotCounting,
  expectOpensAtUnreadLine,
  expectWholeConversation,
  FIRST_UNREAD_TURN_TEXT,
} from './support/admin-conversation'
import { conversationOf, installQueueBackend } from './support/review-backend'
import { expect, test } from './support/test'

/** The review queue in English, which is the locale the assertions' copy is taken from. */
const QUEUE_PATH = `/en${ROUTES.ADMIN_DEFENSES}`

/** How long the fake backend has to answer before a wait is called a failure. */
const SETTLE_TIMEOUT_MS = 15_000

test.describe('the review queue', () => {
  test('reads every loaded page again on refresh, putting a new conversation on top', async ({
    page,
  }) => {
    // Three conversations, which run onto a second page
    const backend = await installQueueBackend(page, [
      conversationOf('first@students.test', '2026-09-27T10:00:00Z'),
      conversationOf('second@students.test', '2026-09-27T09:00:00Z'),
      conversationOf('third@students.test', '2026-09-27T08:00:00Z'),
    ])

    // Every student's address on the cards, top to bottom
    const addresses = page.getByText(/@students\.test$/)

    // Open the queue
    await page.goto(QUEUE_PATH)

    // Which reads both pages, asking for the second on its own
    await expect(addresses).toHaveText(
      ['first@students.test', 'second@students.test', 'third@students.test'],
      { timeout: SETTLE_TIMEOUT_MS }
    )

    // How many reads the queue took to get here
    const asksBefore = backend.pagesAsked().length

    // A student speaks up after the queue loaded
    backend.arrive(conversationOf('new@students.test', '2026-09-27T11:00:00Z'))

    // The backend holds its answer, so the refresh can be caught in flight
    const release = backend.hold()

    // The refresh button
    const refresh = page.getByRole('button', { name: messages.admin.defenseReview.refresh })

    // Pressed
    await refresh.click()

    // The button stands disabled while the queue is read again, so a second press can't stack another read
    await expect(refresh).toBeDisabled()

    // The backend answers
    release()

    // The new conversation lands on top, and every card loaded before stays on screen under it
    await expect(addresses).toHaveText([
      'new@students.test',
      'first@students.test',
      'second@students.test',
      'third@students.test',
    ])

    // Both loaded pages were read again, in order, and nothing else was
    expect(backend.pagesAsked().slice(asksBefore)).toEqual([1, 2])

    // The button is ready to be pressed again
    await expect(refresh).toBeEnabled()
  })

  test('marks every loaded unread conversation read in one request', async ({ page }) => {
    // Two unread conversations, with one already read between them
    const backend = await installQueueBackend(page, [
      conversationOf('first@students.test', '2026-09-27T10:00:00Z'),
      {
        ...conversationOf('read@students.test', '2026-09-27T09:00:00Z'),
        readAt: '2026-09-27T09:30:00Z',
        isUnread: false,
        unreadStudentMessageCount: 0,
      },
      conversationOf('third@students.test', '2026-09-27T08:00:00Z'),
    ])

    // What an unread card says about the student's message nobody has read
    const newMessages = page.getByText('+1 new', { exact: true })

    // Open the queue
    await page.goto(QUEUE_PATH)

    // The new message marked on both unread cards
    await expect(newMessages).toHaveCount(2, { timeout: SETTLE_TIMEOUT_MS })

    // The way to clear them
    const markAllRead = page.getByRole('button', {
      name: messages.admin.defenseReview.markAllRead,
    })

    // Pressed
    await markAllRead.click()

    // Sent as one request naming the unread two, in the order the queue shows them
    await expect
      .poll(() => backend.bulkMarks())
      .toEqual([{ sessionIds: ['session-first@students.test', 'session-third@students.test'] }])

    // Every card reads as read, and there is nothing left to clear
    await expect(newMessages).toHaveCount(0)
    await expect(markAllRead).toBeDisabled()

    // Said how many it took
    await expect(page.getByText('2 conversations marked read')).toBeVisible()
  })
})

test.describe('the conversation dialog', () => {
  test('walks the queue one conversation at a time, from the buttons and from the keys', async ({
    page,
  }) => {
    // Three conversations to walk
    await installQueueBackend(page, [
      conversationOf('first@students.test', '2026-09-27T10:00:00Z'),
      conversationOf('second@students.test', '2026-09-27T09:00:00Z'),
      conversationOf('third@students.test', '2026-09-27T08:00:00Z'),
    ])

    // Open the queue
    await page.goto(QUEUE_PATH)

    // Open the first conversation from its card
    await page.getByText('first@students.test').click({ timeout: SETTLE_TIMEOUT_MS })

    // The dialog it opens in, and its way along the queue
    const dialog = page.getByRole('dialog')
    const previous = dialog.getByRole('button', {
      name: messages.admin.conversation.previous,
      exact: true,
    })
    const next = dialog.getByRole('button', { name: messages.admin.conversation.next, exact: true })

    // The dialog names the student and where they sit, with nothing behind them to go back to
    await expect(dialog.getByText('first@students.test', { exact: true })).toBeVisible()
    await expect(dialog.getByText('1 of 3', { exact: true })).toBeVisible()
    await expect(previous).toBeDisabled()

    // The key for the next one
    await page.keyboard.press('j')

    // Which moves one along
    await expect(dialog.getByText('second@students.test', { exact: true })).toBeVisible()
    await expect(dialog.getByText('2 of 3', { exact: true })).toBeVisible()

    // The button for the next one
    await next.click()

    // Which reaches the end, where there is nothing further to go to
    await expect(dialog.getByText('third@students.test', { exact: true })).toBeVisible()
    await expect(next).toBeDisabled()

    // The key for the one before
    await page.keyboard.press('k')

    // Which moves back one
    await expect(dialog.getByText('second@students.test', { exact: true })).toBeVisible()

    // Closed
    await dialog.getByRole('button', { name: messages.ui.actions.close }).click()

    // And gone
    await expect(dialog).toBeHidden()
  })

  test('keeps the open conversation in the address, and opens on the one a link names', async ({
    page,
  }) => {
    // Two conversations to walk
    await installQueueBackend(page, [
      conversationOf('first@students.test', '2026-09-27T10:00:00Z'),
      conversationOf('second@students.test', '2026-09-27T09:00:00Z'),
    ])

    // A function which reads the query the address carries
    const queryOf = () => new URL(page.url()).search

    // Open the queue
    await page.goto(QUEUE_PATH)

    // Open the first conversation from its card
    await page.getByText('first@students.test').click({ timeout: SETTLE_TIMEOUT_MS })

    // The dialog it opens in
    const dialog = page.getByRole('dialog')
    await expect(dialog.getByText('1 of 2', { exact: true })).toBeVisible()

    // Named in the address
    await expect.poll(queryOf).toBe('?open=session-first%40students.test')

    // One along
    await page.keyboard.press('j')

    // Named in its place
    await expect.poll(queryOf).toBe('?open=session-second%40students.test')

    // Closed
    await dialog.getByRole('button', { name: messages.ui.actions.close }).click()

    // Which leaves the bare queue
    await expect.poll(queryOf).toBe('')

    // A link to the second conversation
    await page.goto(`${QUEUE_PATH}?open=session-second%40students.test`)

    // Which opens on it
    await expect(dialog.getByText('second@students.test', { exact: true })).toBeVisible({
      timeout: SETTLE_TIMEOUT_MS,
    })
    await expect(dialog.getByText('2 of 2', { exact: true })).toBeVisible()
  })

  test('shows a conversation whole', async ({ page }) => {
    // One conversation
    await installQueueBackend(page, [conversationOf('first@students.test', '2026-09-27T10:00:00Z')])

    // Open the queue
    await page.goto(QUEUE_PATH)

    // Open the conversation from its card
    await page.getByText('first@students.test').click({ timeout: SETTLE_TIMEOUT_MS })

    // The reply and the follow-up timed, the student's report and verdict, and the drafts behind the reply
    await expectWholeConversation(page.getByRole('dialog'))
  })

  test('stands the parts of a conversation side by side as the viewport widens', async ({
    page,
  }) => {
    // One conversation
    await installQueueBackend(page, [conversationOf('first@students.test', '2026-09-27T10:00:00Z')])

    // Read on a screen too narrow for a split
    await page.setViewportSize({ width: 1024, height: 800 })

    // Open the queue
    await page.goto(QUEUE_PATH)

    // Open the conversation from its card
    await page.getByText('first@students.test').click({ timeout: SETTLE_TIMEOUT_MS })

    // The dialog, its tabs, and what each one is called
    const dialog = page.getByRole('dialog')
    const tabs = dialog.getByRole('tab')
    const tabNames = { ...messages.admin.conversation.tabs, notes: messages.admin.notes.tab }

    // Narrow, so every part is a tab and the conversation is one of them
    await expect(tabs).toHaveText([
      tabNames.conversation,
      tabNames.reference,
      tabNames.notes,
      tabNames.config,
    ])

    // Wide enough to split
    await page.setViewportSize({ width: 1400, height: 800 })

    // The conversation stands on its own, and the rest are tabs beside it
    await expect(tabs).toHaveText([tabNames.reference, tabNames.notes, tabNames.config])
    await expect(dialog.getByText('The answer is 2.')).toBeVisible()

    // Wide enough for the solution to have a column of its own
    await page.setViewportSize({ width: 1700, height: 900 })

    // The solution stays on screen, and stops being a tab
    await expect(tabs).toHaveText([tabNames.notes, tabNames.config])
    await expect(dialog.getByRole('region', { name: tabNames.reference })).toBeVisible()
  })

  test('stays on the part being read when stepping to the next conversation', async ({ page }) => {
    // Two conversations
    await installQueueBackend(page, [
      conversationOf('first@students.test', '2026-09-27T10:00:00Z'),
      conversationOf('second@students.test', '2026-09-27T09:00:00Z'),
    ])

    // Read on a screen narrow enough that every part is a tab
    await page.setViewportSize({ width: 1024, height: 800 })

    // Open the queue
    await page.goto(QUEUE_PATH)

    // Open the first conversation from its card
    await page.getByText('first@students.test').click({ timeout: SETTLE_TIMEOUT_MS })

    // The dialog and its notes tab
    const dialog = page.getByRole('dialog')
    const notesTab = dialog.getByRole('tab', { name: messages.admin.notes.tab })

    // Turn to the notes
    await notesTab.click()

    // Which shows them
    await expect(notesTab).toHaveAttribute('aria-selected', 'true')

    // Step on
    await page.keyboard.press('j')

    // The next conversation opens on the notes too
    await expect(dialog.getByText('second@students.test', { exact: true })).toBeVisible()
    await expect(notesTab).toHaveAttribute('aria-selected', 'true')
  })

  test("lists the student's other conversations, the one after the hand-in not counting", async ({
    page,
  }) => {
    // One student's two conversations about the problem, the later one started after they handed in
    await installQueueBackend(
      page,
      [
        conversationOf('ada@students.test', '2026-09-27T10:00:00Z', 'session-late'),
        conversationOf('ada@students.test', '2026-09-27T09:00:00Z', 'session-early'),
      ],
      {
        grading: {
          'user-ada@students.test': {
            countingConversationIds: ['session-early'],
            grade: null,
            selfAssessment: null,
          },
        },
      }
    )

    // Open the queue
    await page.goto(QUEUE_PATH)

    // Open the later conversation from its card
    await page.getByText('ada@students.test').first().click({ timeout: SETTLE_TIMEOUT_MS })

    // The dialog it opens in
    const dialog = page.getByRole('dialog')

    // Both listed oldest first, the later one marked as not counting
    await expectOnlyNotCounting(dialog, 2, 2)

    // On the one opened from the queue
    await expect(dialog.getByRole('button', { name: /^Conversation 2/ })).toHaveAttribute(
      'aria-pressed',
      'true'
    )

    // The earlier one, picked
    await dialog.getByRole('button', { name: /^Conversation 1/ }).click()

    // Which shows it, while the queue stays on the one opened
    await expect(dialog.getByRole('button', { name: /^Conversation 1/ })).toHaveAttribute(
      'aria-pressed',
      'true'
    )
    await expect(dialog.getByText('1 of 2', { exact: true })).toBeVisible()
  })

  test('shows the grade of a graded student, and none of an ungraded one', async ({ page }) => {
    // A graded student, then an ungraded one who has held two conversations
    await installQueueBackend(
      page,
      [
        conversationOf('graded@students.test', '2026-09-27T10:00:00Z'),
        conversationOf('practising@students.test', '2026-09-27T09:00:00Z'),
        conversationOf(
          'practising@students.test',
          '2026-09-27T08:00:00Z',
          'session-practising-earlier'
        ),
      ],
      {
        grading: {
          'user-graded@students.test': {
            countingConversationIds: ['session-graded@students.test'],
            grade: null,
            selfAssessment: null,
          },
        },
      }
    )

    // Read on a screen narrow enough that every part is a tab
    await page.setViewportSize({ width: 1024, height: 800 })

    // Open the queue
    await page.goto(QUEUE_PATH)

    // Open the graded student's conversation from its card
    await page.getByText('graded@students.test').click({ timeout: SETTLE_TIMEOUT_MS })

    // The dialog, its grade tab and its conversation tab
    const dialog = page.getByRole('dialog')
    const gradeTab = dialog.getByRole('tab', { name: messages.admin.grades.tab })
    const conversationTab = dialog.getByRole('tab', {
      name: messages.admin.conversation.tabs.conversation,
    })

    // Turn to the grade, which a graded student has
    await gradeTab.click()

    // On to the ungraded student
    await page.keyboard.press('j')

    // Whose conversations have arrived, the switch between them standing for the answer that says whether
    // they are graded, since both come in one reply
    await expect(dialog.getByRole('button', { name: /^Conversation 2/ })).toBeVisible()

    // Not graded, so the conversation shows in place of a grade
    await expect(gradeTab).toHaveCount(0)
    await expect(conversationTab).toHaveAttribute('aria-selected', 'true')
  })

  test('opens a half-read conversation where reading stopped, and stays put once marked unread', async ({
    page,
  }) => {
    // One conversation, read halfway
    await installQueueBackend(
      page,
      [conversationOf('first@students.test', '2026-09-27T10:00:00Z')],
      { partlyRead: ['session-first@students.test'] }
    )

    // Open the queue
    await page.goto(QUEUE_PATH)

    // Open the conversation from its card
    await page.getByText('first@students.test').click({ timeout: SETTLE_TIMEOUT_MS })

    // The dialog
    const dialog = page.getByRole('dialog')

    // Opened at the line where the reading stopped
    await expectOpensAtUnreadLine(dialog)

    // The server's answer to marking it unread, watched for from before the click so it can't slip past
    const answered = page.waitForResponse(
      (response) => response.request().method() === 'DELETE' && response.url().endsWith('/review')
    )

    // The whole conversation marked back to unread, which moves where the next pass starts to its top
    await dialog
      .getByRole('button', { name: messages.admin.conversation.markUnread, exact: true })
      .click()

    // Taken, the toggle offering the way back
    await expect(
      dialog.getByRole('button', { name: messages.admin.conversation.markRead, exact: true })
    ).toBeVisible()

    // Wait for the server's answer to the mark
    await answered

    // The conversation left where the reader had it rather than taken back to its top
    await expect(dialog.getByText(FIRST_UNREAD_TURN_TEXT)).toBeInViewport()
  })
})
