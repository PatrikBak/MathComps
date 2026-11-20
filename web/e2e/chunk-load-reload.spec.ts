import type { Page } from '@playwright/test'

import { ROUTES } from '@/i18n/i18n'

import { fillSessionStorage } from './support/emulation'
import { expect, test } from './support/test'
import { countPageLoads, recordHeadings } from './support/watchers'

/**
 * The handouts page in English, whose outro opens the contact form, a modal loaded on demand. The locale is
 * fixed here because it picks the copy the assertions match on.
 */
const HANDOUTS_PATH = `/en${ROUTES.HANDOUTS}`

/** A string only the contact form's chunk holds: the address it sends a message to. */
const CONTACT_FORM_MARKER = '/api/contact'

/** The copy the page reads in. */
const copy = {
  /** The link in the handouts outro that opens the contact form. */
  open: 'send feedback',
  /** A field of the contact form, there once its chunk has loaded. */
  formField: 'Name',
  /** The heading of the page shown when rendering fails. */
  errorTitle: 'Something went wrong',
} as const

/**
 * Answers every download of the contact form's chunk with the 410 a deployment gone past skew protection
 * gives, until told to stop. Every other script arrives as the server sent it.
 *
 * @param page - The page that downloads the chunk.
 *
 * @returns A function which lets the chunk arrive from then on, as it does for a page of the current
 * deployment.
 */
async function failContactFormChunk(page: Page): Promise<() => void> {
  // Whether the chunk's downloads still fail
  let isFailing = true

  // Every script the app serves, read before it is handed over
  await page.route(
    (url) => url.pathname.startsWith('/_next/static/') && url.pathname.endsWith('.js'),
    async (route) => {
      // The script as the server sent it
      const response = await route.fetch()
      const body = await response.text()

      // The form's chunk while it fails
      if (isFailing && body.includes(CONTACT_FORM_MARKER)) {
        // Gone, as an expired deployment answers
        await route.fulfill({ status: 410 })
        return
      }

      // Any other script, or the form's once it arrives again
      await route.fulfill({ response, body })
    }
  )

  // The switch that lets the chunk arrive
  return () => {
    isFailing = false
  }
}

test.describe('a chunk that fails to load', () => {
  test('reloads the page once, and the next click opens the form', async ({ page }) => {
    // Every heading the page shows
    const headings = await recordHeadings(page)

    // Every document the page loads
    const pageLoads = countPageLoads(page)

    // The form's chunk gone, as for a page kept open past a deploy
    const letChunkArrive = await failContactFormChunk(page)

    // The handouts page
    await page.goto(HANDOUTS_PATH)

    // The reload, awaited from before the click that causes it
    const reloaded = page.waitForEvent('load')

    // The form asked for, whose chunk fails
    await page.getByRole('button', { name: copy.open }).click()

    // The page reloaded itself
    await reloaded

    // The chunk there for the fresh page, as for a page of the current deployment
    letChunkArrive()

    // The form asked for again
    await page.getByRole('button', { name: copy.open }).click()

    // The form, there
    await expect(page.getByLabel(copy.formField)).toBeVisible()

    // Loaded twice
    expect(pageLoads()).toBe(2)

    // And the error page never showed, not even for a moment
    expect(headings()).not.toContain(copy.errorTitle)
  })

  test('shows the error page once it still fails after the reload', async ({ page }) => {
    // Every document the page loads
    const pageLoads = countPageLoads(page)

    // The form's chunk gone for good
    await failContactFormChunk(page)

    // The handouts page
    await page.goto(HANDOUTS_PATH)

    // The reload, awaited from before the click that causes it
    const reloaded = page.waitForEvent('load')

    // The form asked for, whose chunk fails
    await page.getByRole('button', { name: copy.open }).click()

    // The page reloaded itself
    await reloaded

    // The form asked for again, whose chunk fails again
    await page.getByRole('button', { name: copy.open }).click()

    // The error page
    await expect(page.getByRole('heading', { name: copy.errorTitle })).toBeVisible()

    // After a single reload
    expect(pageLoads()).toBe(2)
  })

  test('shows the error page without reloading in a tab that cannot record the reload', async ({
    page,
  }) => {
    // Every document the page loads
    const pageLoads = countPageLoads(page)

    // A tab whose session storage is full
    await fillSessionStorage(page)

    // The form's chunk gone for good
    await failContactFormChunk(page)

    // The handouts page
    await page.goto(HANDOUTS_PATH)

    // The form asked for, whose chunk fails
    await page.getByRole('button', { name: copy.open }).click()

    // The error page, since a reload nothing records could repeat forever
    await expect(page.getByRole('heading', { name: copy.errorTitle })).toBeVisible()

    // Without a reload
    expect(pageLoads()).toBe(1)
  })
})
