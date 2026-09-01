import { BACKEND_ORIGIN } from './support/backend-routes'
import { areaCopy, areaPath, LIST_PATH } from './support/competitions'
import { installHostedBackend } from './support/hosted-backend'
import { expect, test } from './support/test'

/** How long the fake backend has to answer before a wait is called a failure. */
const SETTLE_TIMEOUT_MS = 15_000

/** A competition that closed a month ago, whose problems the list offers to anybody. */
const CLOSED_COMPETITION_SLUG = 'closed-special-set'

test.describe('the competitions list', () => {
  test('asks a reader with no account for one rather than opening the entry', async ({ page }) => {
    // The competitions surface, on the one state carrying no entry anywhere. The reader has no
    // account of their own: this spec runs without a session
    await installHostedBackend(page, 'first-entry')

    // Open the list
    await page.goto(LIST_PATH)

    // The list says up front what an entry would need of them
    await expect(page.getByText('You can compete once you')).toBeVisible({
      timeout: SETTLE_TIMEOUT_MS,
    })

    // And no way to be rid of it: there is no account to keep that answer against
    await expect(page.getByRole('button', { name: areaCopy.readiness.dismiss })).toHaveCount(0)

    // Press enter, whose label reads the same in every state
    await page.getByRole('button', { name: areaCopy.enter, exact: true }).first().click()

    // The reader is asked to log in
    await expect(page.getByText(/You must log in to/)).toBeVisible()

    // And no entry dialog opened behind the prompt
    await expect(page.getByRole('dialog')).toHaveCount(0)
  })

  test('sends a reader with no account back from a closed competition it offers them', async ({
    page,
  }) => {
    // The competitions surface, read without a session
    await installHostedBackend(page, 'first-entry')

    // The area of a competition that closed a month ago, which the list links them to
    await page.goto(areaPath(CLOSED_COMPETITION_SLUG))

    // Back on the list, the set being read as the reader and there being nobody to read it as
    await expect(page).toHaveURL(/\/competitions$/, { timeout: SETTLE_TIMEOUT_MS })

    // Asked for the account that is the only thing between them and the problems
    await expect(page.getByText(areaCopy.areaSignIn)).toBeVisible({ timeout: SETTLE_TIMEOUT_MS })
  })

  test('says the list failed to load rather than that nothing is scheduled', async ({ page }) => {
    // The competitions surface
    await installHostedBackend(page, 'first-entry')

    // Whose one read then stops answering
    await page.route(`${BACKEND_ORIGIN}/competitions`, (route) => route.abort('connectionrefused'))

    // Open the list
    await page.goto(LIST_PATH)

    // Which says the read failed
    await expect(page.getByText(areaCopy.loadFailed)).toBeVisible({ timeout: SETTLE_TIMEOUT_MS })

    // And not that the program has nothing on, which a failed read is in no position to say
    await expect(page.getByText(areaCopy.noCompetitions)).toHaveCount(0)
  })
})
