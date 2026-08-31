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

/** How long Clerk gets to boot, held under a test's own timeout so this wait is the one that fires. */
const CLERK_BOOT_TIMEOUT_MS = 15_000

/**
 * Waits for Clerk's client to finish booting, and names Clerk when it never does.
 *
 * Every helper here reaches through window.Clerk, and each simply waits while the client is still
 * booting. A client that never finishes therefore surfaces as a bare test timeout on whichever line
 * touched it first, and every test behind it reports a failure of its own, none of them naming Clerk.
 *
 * @param page - The page whose Clerk client to wait on.
 */
async function waitForClerk(page: Page): Promise<void> {
  // Wait for the client to say it is up
  try {
    await page.waitForFunction(() => window.Clerk?.loaded === true, null, {
      timeout: CLERK_BOOT_TIMEOUT_MS,
    })
  } catch {
    // Name the likely cause, which a bare timeout never does
    throw new Error(
      `Clerk did not finish loading within ${CLERK_BOOT_TIMEOUT_MS}ms. The app and the Clerk instance ` +
        'are usually looping over the handshake redirect, which they do while the dev-browser cookie ' +
        'never lands. Clerk leaves the Secure attribute off that cookie for a browser calling itself ' +
        'HeadlessChrome, and Chromium refuses a SameSite=None cookie without it, so check that ' +
        'playwright.config.ts still hands the run a User-Agent.'
    )
  }
}

/**
 * Signs the test account in, once Clerk's client on the page is up to sign it in with.
 *
 * The account is signed in through Clerk's own API rather than the form, since Turnstile deadlocks
 * an automated browser. The session this mints belongs to the page it was minted on, which is what
 * lets a test end it without taking any other test's session down with it.
 *
 * @param page - The page to sign in on, sitting on a page of the app so that Clerk boots.
 */
export async function signInTestUser(page: Page): Promise<void> {
  // Nothing can be signed in until the client is up
  await waitForClerk(page)

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
