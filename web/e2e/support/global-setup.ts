import { clerkSetup } from '@clerk/testing/playwright'

/**
 * Mints the short-lived token that gets an automated browser past Clerk's bot protection.
 *
 * It is parked in the environment the workers are forked from, so every project inherits it. Any
 * test that signs somebody in needs it, and without it the sign-in fails at the bot check with an
 * error naming neither the account nor the test.
 */
export default async function globalSetup(): Promise<void> {
  // Clerk hands the token over and parks it under the name its own helpers read it from
  await clerkSetup()
}
