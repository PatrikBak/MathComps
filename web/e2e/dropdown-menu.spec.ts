import { ROUTES } from '@/i18n/i18n'

import messages from '../messages/en.json'
import { swipeDownByTouch } from './support/interaction'
import { expect, test } from './support/test'
import { countAttributeChanges } from './support/watchers'

/** The about page in English, plain static content under the header. */
const ABOUT_PATH = `/en${ROUTES.ABOUT}`

/** How far down the page sits before a swipe scrolls it back up, in pixels. */
const SCROLLED_DOWN_PX = 400

/** How far a finger travels down the screen in a swipe, in pixels, short enough to stay inside the window. */
const SWIPE_PX = 100

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

  test.describe('on a touchscreen', () => {
    // A finger in place of a mouse
    test.use({ hasTouch: true })

    test('scrolls the page under a swipe that starts on the button, leaving the menu shut', async ({
      page,
    }) => {
      // Open the page, its header carrying the language menu
      await page.goto(ABOUT_PATH)

      // Scroll the page part way down, so it has room to scroll back up
      await page.evaluate((top) => window.scrollTo(0, top), SCROLLED_DOWN_PX)

      // The language menu's button, kept on screen by the sticky header
      const button = page.getByRole('button', { name: messages.common.language.change })

      // How many times the button's menu opens or shuts from here on
      const menuChanges = await countAttributeChanges(button, 'aria-expanded')

      // A finger landing on the button and dragged down the screen
      await swipeDownByTouch(page, button, SWIPE_PX)

      // The page scrolled back up under the finger
      await expect.poll(() => page.evaluate(() => window.scrollY)).toBeLessThan(SCROLLED_DOWN_PX)

      // And the menu never opened, not even for a moment
      expect(await menuChanges()).toBe(0)
    })

    test('opens the menu on a tap', async ({ page }) => {
      // Open the page, its header carrying the language menu
      await page.goto(ABOUT_PATH)

      // Tap the language menu's button
      await page.getByRole('button', { name: messages.common.language.change }).tap()

      // The menu open
      await expect(page.getByRole('menu')).toBeVisible()
    })
  })
})
