import { clerk, clerkSetup } from '@clerk/testing/playwright'
import { test as setup } from '@playwright/test'

import { storageStatePath } from '../playwright.config'

// Signing in without the token only fails at Clerk's bot check, so skip it outright once minting fails.
setup.describe.configure({ mode: 'serial' })

/**
 * Reads a credential the sign-in run cannot proceed without.
 *
 * @param name - The environment variable's name.
 *
 * @returns The variable's value.
 */
function requireEnv(name: string): string {
  // Whatever the local environment holds under that name
  const value = process.env[name]

  // Left absent or blank, this surfaces much later as an opaque Clerk rejection. A bare `KEY=` line is
  // the likelier of the two, so an empty value counts as missing rather than being handed over.
  if (value === undefined || value.trim() === '') {
    throw new Error(`Missing ${name}. Add it to web/.env.local.`)
  }

  // Hand back the credential
  return value
}

// Mints the short-lived token that gets an automated browser past Clerk's bot protection.
setup('mint a Clerk testing token', async () => {
  await clerkSetup()
})

// Signs the test account in and parks the session for a browser to start from.
setup('sign in and save the session', async ({ page }) => {
  // Clerk's client only exists once a page of the app has booted.
  await page.goto('/')

  // Going through Clerk's API rather than the sign-in form keeps Turnstile out of the path.
  await clerk.signIn({
    page,
    signInParams: {
      strategy: 'password',
      identifier: requireEnv('E2E_CLERK_USER_EMAIL'),
      password: requireEnv('E2E_CLERK_USER_PASSWORD'),
    },
  })

  // The profile page renders nothing for a signed-out visitor, so reaching it proves the session took.
  await page.goto('/en/profile')

  // The header swaps the sign-in link for this menu only once Clerk resolves a user.
  await page.getByRole('button', { name: 'User menu' }).waitFor()

  // Cookies plus local storage are what a fresh browser needs to start out authenticated.
  await page.context().storageState({ path: storageStatePath })
})
