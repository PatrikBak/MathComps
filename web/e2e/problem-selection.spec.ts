import messages from '../messages/en.json'
import { SELECTION_PATH } from './support/competitions'
import { expect, SETTLE_TIMEOUT_MS, test } from './support/test'

/** What the selection says to a visitor nobody is signed in as, read without the markup around its link. */
const SIGN_IN_PROMPT = messages.problemSelection.access.signIn.replace(/<\/?link>/g, '')

test.describe('the problem selection, signed out', () => {
  test('asks a visitor to sign in rather than waiting on a read that never starts', async ({
    page,
  }) => {
    // The selection, opened by nobody in particular
    await page.goto(SELECTION_PATH)

    // Asked to sign in, where the pool would be
    await expect(page.getByText(SIGN_IN_PROMPT)).toBeVisible({ timeout: SETTLE_TIMEOUT_MS })
  })
})
