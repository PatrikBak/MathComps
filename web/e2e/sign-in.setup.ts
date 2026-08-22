import { test as setup } from '@playwright/test'

import messages from '../messages/en.json'
import { storageStatePath } from '../playwright.config'
import { signInTestUser } from './support/session'

// Signs the test account in and parks the session for a browser to start from.
setup('sign in and save the session', async ({ page }) => {
  // Clerk's client only exists once a page of the app has booted.
  await page.goto('/')

  // The account the parked session belongs to.
  await signInTestUser(page)

  // The profile page renders nothing for a signed-out visitor, so reaching it proves the session took.
  await page.goto('/en/profile')

  // The header swaps the sign-in link for this menu only once Clerk resolves a user.
  await page.getByRole('button', { name: messages.ui.userMenu.label, exact: true }).waitFor()

  // Cookies plus local storage are what a fresh browser needs to start out authenticated.
  await page.context().storageState({ path: storageStatePath })
})
