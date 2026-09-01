import type { Page } from '@playwright/test'

import { areaPath, editorCopy, modalCopy, openExistingDefense } from './support/competitions'
import { COMPETITION_ID, installHostedBackend } from './support/hosted-backend'
import { expect, test } from './support/test'

/** How long the fake backend has to answer before a wait is called a failure. */
const SETTLE_TIMEOUT_MS = 15_000

/**
 * Opens a chat's composer, expands it to its modal, and closes that again.
 *
 * @param page - The page it is being opened on.
 * @param dismiss - Which way out of the expanded view is taken.
 *
 * @returns The inline composer, which is the only textarea standing once the modal is gone.
 */
async function expandAndCollapse(page: Page, dismiss: 'button' | 'escape') {
  // A student inside a competition
  await installHostedBackend(page, 'running')

  // Open its area
  await page.goto(areaPath(COMPETITION_ID))

  // And the conversation already seeded on the first problem
  await openExistingDefense(page)

  // The composer
  const composer = page.locator('textarea')

  // Live once the resume has settled
  await expect(composer).toBeEditable({ timeout: SETTLE_TIMEOUT_MS })

  // Expanded, which stands a second editor over this one
  await page.getByTitle(editorCopy.expandEditor).click()

  // The expanded view, named because the chat it is written in is a dialog of its own
  const expanded = page.getByRole('dialog', { name: editorCopy.expandedEditor })

  // Open with the cursor in it
  await expect(expanded.locator('textarea')).toBeFocused()

  // And closed again, the way this run is taking
  if (dismiss === 'escape') {
    await page.keyboard.press('Escape')
  } else {
    await expanded.getByRole('button', { name: modalCopy.close }).click()
  }

  // Gone from the page
  await expect(expanded).toHaveCount(0)

  // What the reader is left writing in
  return composer
}

test.describe('the editor expanded to its modal', () => {
  test('hands the cursor back on the way out', async ({ page }) => {
    // A composer taken to the expanded view and back
    const composer = await expandAndCollapse(page, 'button')

    // The cursor, back where the reader writes
    await expect(composer).toBeFocused()

    // Typed without reaching for the mouse
    await page.keyboard.type('A bound that holds')

    // And it lands
    await expect(composer).toHaveValue('A bound that holds')
  })

  test('leaves the toolbar underneath it still editing', async ({ page }) => {
    // The same trip, taken by the key that dismisses the expanded view
    const composer = await expandAndCollapse(page, 'escape')

    // A draft to work on
    await composer.fill('A bound')

    // Bold, which is the cheapest thing the toolbar can be asked for
    await page.getByTitle(/^Bold/).click()

    // And the marks land around it
    await expect(composer).toHaveValue(/\*\*/)
  })
})
