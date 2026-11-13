import { RETURN_URL_PARAM } from '@/constants/auth-constants'

import { addressParams } from './support/address'
import { headerSignInLink } from './support/interaction'
import { signInTestUser } from './support/session'
import { expect, SETTLE_TIMEOUT_MS, test } from './support/test'

/** The page the reader sets out to sign in from, and means to come back to. */
const ABOUT_PATH = '/en/about'

test.describe("the sign-in page's own sign-in link", () => {
  test('keeps the way back the address carries', async ({ page }) => {
    // The about page, where the reader starts
    await page.goto(ABOUT_PATH)

    // Sign in from the header
    await headerSignInLink(page).click()

    // The login page, coming back to the about page
    await expect
      .poll(() => addressParams(page).get(RETURN_URL_PARAM), { timeout: SETTLE_TIMEOUT_MS })
      .toBe(ABOUT_PATH)

    // The header's sign-in link, pressed again on the login page itself
    await headerSignInLink(page).click()

    // Signing in from there
    await signInTestUser(page)

    // Back on the about page
    await expect(page).toHaveURL(ABOUT_PATH, { timeout: SETTLE_TIMEOUT_MS })
  })
})
