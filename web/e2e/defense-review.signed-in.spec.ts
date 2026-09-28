import { ROUTES } from '@/i18n/i18n'

import messages from '../messages/en.json'
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
    const tabNames = { ...messages.admin.conversation.tabs, ...messages.admin.defenseReview.tabs }

    // Narrow, so every part is a tab and the conversation is one of them
    await expect(tabs).toHaveText([
      tabNames.conversation,
      tabNames.reference,
      tabNames.config,
      tabNames.notes,
    ])

    // Wide enough to split
    await page.setViewportSize({ width: 1400, height: 800 })

    // The conversation stands on its own, and the rest are tabs beside it
    await expect(tabs).toHaveText([tabNames.reference, tabNames.config, tabNames.notes])
    await expect(dialog.getByText('The answer is 2.')).toBeVisible()

    // Wide enough for the solution to have a column of its own
    await page.setViewportSize({ width: 1700, height: 900 })

    // The solution stays on screen, and stops being a tab
    await expect(tabs).toHaveText([tabNames.config, tabNames.notes])
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
    const notesTab = dialog.getByRole('tab', { name: messages.admin.defenseReview.tabs.notes })

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
})
