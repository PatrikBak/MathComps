import { ROUTES } from '@/i18n/i18n'

import { MATHILDA_OPENER } from './support/backend-routes'
import { chatCopy } from './support/competitions'
import { expect, test } from './support/test'

/** How long the page has to settle before a wait is called a failure. */
const SETTLE_TIMEOUT_MS = 15_000

/**
 * A published handout whose problems carry a solution to defend, in English, which is the canonical
 * locale and so carries no route translation. The only thing it asks the backend for is the greeting an
 * opened chat shows, which the ambient stubs already answer.
 */
const HANDOUT_PATH = `/en${ROUTES.HANDOUTS}/proofs-basics`

test.describe('the defense composer', () => {
  test('asks a visitor with no account for one instead of leaving them on a spinner', async ({
    page,
  }) => {
    // A published handout, opened by nobody in particular
    await page.goto(HANDOUT_PATH)

    // The chats its problems offer, one of which is enough
    const triggers = page.getByRole('button', { name: /Mathilda/i })

    // Held until one of them is on screen
    await expect(triggers.first()).toBeVisible({ timeout: SETTLE_TIMEOUT_MS })

    // Opened on the first of them
    await triggers.first().click()

    // Greeted all the same, which is the whole of what there is to read without an account
    await expect(page.getByText(MATHILDA_OPENER.opener)).toBeVisible({ timeout: SETTLE_TIMEOUT_MS })

    // The way in is what the composer offers
    await expect(page.getByText(chatCopy.loginPrompt)).toBeVisible({ timeout: SETTLE_TIMEOUT_MS })

    // Rather than a wait on the acknowledgement, which never reads for a visitor with no account
    await expect(page.getByText(chatCopy.libraryLoading)).toHaveCount(0)
  })
})
