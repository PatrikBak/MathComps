import { expect, test } from '@playwright/test'

import { areaCopy, LIST_PATH } from './support/competitions'
import { installHostedBackend } from './support/hosted-backend'

/** How long the fake backend has to answer before a wait is called a failure. */
const SETTLE_TIMEOUT_MS = 15_000

test.describe('the competitions list', () => {
  test('asks a reader with no account for one rather than opening the entry', async ({ page }) => {
    // The competitions surface, on the one state carrying no entry anywhere. The reader has no
    // account of their own: this spec runs without a session
    await installHostedBackend(page, 'first-entry')

    // Open the list
    await page.goto(LIST_PATH)

    // The list says up front what an entry would need of them
    await expect(page.getByText('You can compete once you')).toBeVisible({
      timeout: SETTLE_TIMEOUT_MS,
    })

    // Press enter, whose label reads the same in every state
    await page.getByRole('button', { name: areaCopy.enter, exact: true }).first().click()

    // The reader is asked to log in
    await expect(page.getByText(/You must log in to/)).toBeVisible()

    // And no entry dialog opened behind the prompt
    await expect(page.getByRole('dialog')).toHaveCount(0)
  })
})
