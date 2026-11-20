import { RETURN_URL_PARAM } from '@/constants/auth-constants'

import messages from '../messages/en.json'
import { addressParams } from './support/address'
import { headerSignInLink, openUserMenu } from './support/interaction'
import { signInTestUser } from './support/session'
import { expect, SETTLE_TIMEOUT_MS, test } from './support/test'

/** The page the reader sets out to sign in from, and means to come back to. */
const ABOUT_PATH = '/en/about'

/** An address typed into the sign-in form. */
const TYPED_EMAIL = 'reader@example.com'

/** A password typed into the sign-in form. */
const TYPED_PASSWORD = 'typed-password'

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

test.describe('the sign-in form after a sign-out', () => {
  test('starts over, keeping nothing typed before the sign-in', async ({ page }) => {
    // The hub's way into the email form
    const continueWithEmail = page.getByRole('button', {
      name: messages.auth.continueWithEmail,
      exact: true,
    })

    // The form's email field
    const emailField = page.getByRole('textbox', { name: messages.auth.emailLabel, exact: true })

    // The about page, where the reader starts
    await page.goto(ABOUT_PATH)

    // Sign in from the header
    await headerSignInLink(page).click()

    // On to the email form
    await continueWithEmail.click()

    // An address typed
    await emailField.fill(TYPED_EMAIL)

    // And sent on
    await page.getByRole('button', { name: messages.auth.continue, exact: true }).click()

    // A password typed on the screen the address leads to
    await page.getByLabel(messages.auth.password, { exact: true }).fill(TYPED_PASSWORD)

    // Signed in while the form holds both
    await signInTestUser(page)

    // Back on the about page
    await expect(page).toHaveURL(ABOUT_PATH, { timeout: SETTLE_TIMEOUT_MS })

    // The user menu, opened
    await openUserMenu(page)

    // Signed out from it
    await page.getByRole('menuitem', { name: messages.auth.signOut }).click()

    // Sign in again from the header
    await headerSignInLink(page).click()

    // The form is back at its first screen
    await expect(continueWithEmail).toBeVisible({ timeout: SETTLE_TIMEOUT_MS })

    // On to the email form again
    await continueWithEmail.click()

    // Which holds no address
    await expect(emailField).toHaveValue('')
  })
})
