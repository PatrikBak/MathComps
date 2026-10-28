import { ROUTES } from '@/i18n/i18n'

import messages from '../messages/en.json'
import { expect, test } from './support/test'

/** The about page in English, plain static content under the header. */
const ABOUT_PATH = `/en${ROUTES.ABOUT}`

/**
 * A window too short for the header's language menu. The menu hangs below a trigger near the window's top
 * edge, so there is no taller side for it to flip to.
 */
const SHORT_WINDOW = { width: 1280, height: 160 }

test.describe('dropdown menu', () => {
  // Every test here runs in a window shorter than the menu it opens
  test.use({ viewport: SHORT_WINDOW })

  test('scrolls a menu taller than the window leaves so its last row can be reached', async ({
    page,
  }) => {
    // Open the page, its header carrying the language menu
    await page.goto(ABOUT_PATH)

    // Open the language menu
    await page.getByRole('button', { name: messages.common.language.change }).click()

    // The row furthest down the menu
    const lastRow = page.getByRole('menuitem').last()

    // Scroll the menu down to its last row, the way a reader would
    await lastRow.scrollIntoViewIfNeeded()

    // The last row wholly on screen, which a menu running past the window's bottom edge never allows
    await expect(lastRow).toBeInViewport({ ratio: 1 })
  })
})
