import { clerk } from '@clerk/testing/playwright'
import type { Page } from '@playwright/test'

/**
 * Reads a credential a sign-in cannot proceed without.
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

/**
 * Signs the test account in on a page that already has Clerk loaded.
 *
 * The account is signed in through Clerk's own API rather than the form, since Turnstile deadlocks
 * an automated browser. The session this mints belongs to the page it was minted on, which is what
 * lets a test end it without taking any other test's session down with it.
 *
 * @param page - The page to sign in on, already sitting on a page that loads Clerk.
 */
export async function signInTestUser(page: Page): Promise<void> {
  // The account the suite runs as
  await clerk.signIn({
    page,
    signInParams: {
      strategy: 'password',
      identifier: requireEnv('E2E_CLERK_USER_EMAIL'),
      password: requireEnv('E2E_CLERK_USER_PASSWORD'),
    },
  })
}

/**
 * Ends the session the page is holding, without leaving the page it is on.
 *
 * Clerk's own sign-out navigates, and a test whose page has moved on proves nothing about what the
 * page it left behind would have done. Removing the session instead leaves the reader exactly where
 * they were, which is the whole of what these tests are about.
 *
 * @param page - The page whose session to end.
 */
export async function endSessionInPlace(page: Page): Promise<void> {
  // Clerk revokes the session and tells the app about it, all without touching the URL
  await page.evaluate(async () => {
    await window.Clerk.session?.remove()
  })
}
