import { RETURN_URL_PARAM } from '@/constants/auth-constants'
import { ROUTES } from '@/i18n/i18n'

import { expect, test } from './support/test'

/** How long the redirect has to land before a wait is called a failure. */
const SETTLE_TIMEOUT_MS = 15_000

/** The test group's board, in English. */
const BOARD_PATH = `/en${ROUTES.ADMIN_GRADING.replace('[slug]', 'mc-test')}`

/** The query opening one student's grade on one problem. */
const BOARD_QUERY = { category: 'elementary', student: 's1', problem: 'p1' }

test.describe('an admin page opened by a visitor', () => {
  test('sends them to log in, carrying the whole address back', async ({ page }) => {
    // The board, opened with nobody signed in
    await page.goto(`${BOARD_PATH}?${new URLSearchParams(BOARD_QUERY)}`)

    // Leads to signing in
    await expect(page).toHaveURL(/\/en\/sign-in\?/, { timeout: SETTLE_TIMEOUT_MS })

    // The address the login page will return to
    const returnUrl = new URL(
      new URL(page.url()).searchParams.get(RETURN_URL_PARAM) ?? '',
      page.url()
    )

    // The board itself
    expect(returnUrl.pathname).toBe(BOARD_PATH)

    // With the whole query. Clerk's handshake sorts it on the way in, which the board reads the same.
    expect(Object.fromEntries(returnUrl.searchParams)).toEqual(BOARD_QUERY)
  })
})
