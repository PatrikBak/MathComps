import { BACKEND_ORIGIN } from './support/backend-routes'
import { areaCopy, areaPath, authCopy, LIST_PATH } from './support/competitions'
import { installHostedBackend, PROBLEM_COUNT } from './support/hosted-backend'
import { expect, test } from './support/test'

/** How long the fake backend has to answer before a wait is called a failure. */
const SETTLE_TIMEOUT_MS = 15_000

/** A competition that closed a month ago, whose problems the list offers to anybody. */
const CLOSED_COMPETITION_SLUG = 'closed-special-set'

/** A competition still taking entries, whose problems are nobody's to read without one. */
const OPEN_COMPETITION_SLUG = 'open-advanced'

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

  test('opens a closed competition it offers them to a reader with no account', async ({
    page,
  }) => {
    // The competitions surface, read without a session
    await installHostedBackend(page, 'first-entry')

    // The area of a competition that closed a month ago, which the list links them to
    await page.goto(areaPath(CLOSED_COMPETITION_SLUG))

    // The whole set is drawn: it went public when the competition ended
    await expect(page.getByRole('article')).toHaveCount(PROBLEM_COUNT, {
      timeout: SETTLE_TIMEOUT_MS,
    })

    // And the area is where they stay, rather than being sent back to the list
    await expect(page).toHaveURL(new RegExp(`/competitions/${CLOSED_COMPETITION_SLUG}$`))

    // With how each of them was meant to go, nobody being in the middle of solving one
    await expect(
      page.getByRole('button', { name: areaCopy.officialSolution, exact: true })
    ).toHaveCount(PROBLEM_COUNT)

    // No invitation to argue one of them, arguing a problem being done as somebody
    await expect(page.getByRole('button', { name: areaCopy.startDefense })).toHaveCount(0)

    // And nothing at all to type into, a note about a solution being somebody's too
    await expect(page.locator('textarea')).toHaveCount(0)
  })

  test('sends a reader with no account back from a competition still taking entries', async ({
    page,
  }) => {
    // The competitions surface, read without a session
    await installHostedBackend(page, 'first-entry')

    // The area of a competition whose window is open, which is read through an entry and nothing else
    await page.goto(areaPath(OPEN_COMPETITION_SLUG))

    // Back on the list, an entry being what opens it and an account being what holds one
    await expect(page).toHaveURL(/\/competitions$/, { timeout: SETTLE_TIMEOUT_MS })

    // Asked for that account, rather than told the competition is not theirs, which explains nothing
    await expect(page.getByText(areaCopy.areaAuthReason)).toBeVisible({
      timeout: SETTLE_TIMEOUT_MS,
    })

    // And handed the way to get one
    await expect(page.getByRole('button', { name: authCopy.login })).toBeVisible()
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
