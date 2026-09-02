import type { Page } from '@playwright/test'

import { areaPath, editorCopy, modalCopy, openExistingDefense } from './support/competitions'
import { COMPETITION_SLUG, installHostedBackend } from './support/hosted-backend'
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
  await page.goto(areaPath(COMPETITION_SLUG))

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

/** Where the app's own route mints a presigned upload URL. */
const UPLOAD_URL_PATH = '**/api/files/upload-url'

/** The presigned URL the route hands back, which the browser then PUTs the file to. */
const PRESIGNED_URL = 'https://r2.example.com/presigned/abc'

/** The copy an upload's outcomes read in. */
const uploadCopy = {
  /** The `SERVER_ERROR` code's central copy. */
  serverError: 'Server error',
  /** The `UPLOAD_URL_FAILED` code's central copy. */
  urlFailed: 'Failed to get upload URL',
} as const

/**
 * Hands the editor an image to upload.
 *
 * @param page - The page the editor is on.
 */
async function attachImage(page: Page) {
  // A student inside a competition
  await installHostedBackend(page, 'running')

  // Open its area
  await page.goto(areaPath(COMPETITION_SLUG))

  // And the conversation already seeded on the first problem
  await openExistingDefense(page)

  // Live once the resume has settled
  await expect(page.locator('textarea').first()).toBeEditable({ timeout: SETTLE_TIMEOUT_MS })

  // The picker the toolbar's image button opens, driven directly since a real one cannot be
  await page
    .locator('input[accept="image/*"]')
    .first()
    .setInputFiles({
      name: 'diagram.png',
      mimeType: 'image/png',
      buffer: Buffer.from('89504e470d0a1a0a', 'hex'),
    })
}

test.describe('an image the editor uploads', () => {
  test('writes the markdown once the file is on the store', async ({ page }) => {
    // The route minting a URL, and the store taking the file at it
    await page.route(UPLOAD_URL_PATH, (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ uploadUrl: PRESIGNED_URL, key: 'defense/diagram.png' }),
      })
    )
    await page.route(PRESIGNED_URL, (route) => route.fulfill({ status: 200, body: '' }))

    // An image handed to the editor
    await attachImage(page)

    // The markdown lands in what the reader is writing, which is the whole of the upload having worked
    await expect(page.locator('textarea').first()).toHaveValue(
      '![diagram](media:defense/diagram.png?scale=100)'
    )
  })

  test('shows the coded copy when the route names what it refused on', async ({ page }) => {
    // The route refusing with a code of its own
    await page.route(UPLOAD_URL_PATH, (route) =>
      route.fulfill({
        status: 500,
        contentType: 'application/json',
        body: JSON.stringify({ errorCode: 'SERVER_ERROR' }),
      })
    )

    // An image handed to the editor
    await attachImage(page)

    // The code's own central copy, which only reaches the reader if the code survived the call
    await expect(page.getByText(uploadCopy.serverError)).toBeVisible()
  })

  test('falls back to the upload-url failure when a refusal carries no code', async ({ page }) => {
    // A refusal with nothing in it to name
    await page.route(UPLOAD_URL_PATH, (route) =>
      route.fulfill({ status: 500, contentType: 'application/json', body: '{}' })
    )

    // An image handed to the editor
    await attachImage(page)

    // The upload's own fallback, since the server answered and had no code to give
    await expect(page.getByText(uploadCopy.urlFailed)).toBeVisible()
  })

  test('leaves a request that never reached the server uncoded', async ({ page }) => {
    // The route dropped, which is what being offline looks like from the browser
    await page.route(UPLOAD_URL_PATH, (route) => route.abort('connectionrefused'))

    // An image handed to the editor
    await attachImage(page)

    // The generic server error rather than the upload-url fallback: nothing came back to say the
    // request itself was bad, so nothing may claim it was
    await expect(page.getByText(uploadCopy.serverError)).toBeVisible()
    await expect(page.getByText(uploadCopy.urlFailed)).toHaveCount(0)
  })
})
