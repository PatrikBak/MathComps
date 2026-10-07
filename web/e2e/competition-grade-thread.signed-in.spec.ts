import { areaCopy, areaPath } from './support/competitions'
import { installHostedBackend, problemIdOf } from './support/hosted-backend'
import { expect, test } from './support/test'

/** How long the fake backend has to answer before a wait is called a failure. */
const SETTLE_TIMEOUT_MS = 15_000

/** A competition that closed a month ago, which the student sat. */
const CLOSED_COMPETITION_SLUG = 'closed-special-set'

/** The copy of the student's results, in English. */
const resultsCopy = areaCopy.resultsView

test.describe('the conversation with the graders', () => {
  test('opens the thread a link names, and carries an open one in the address', async ({
    page,
  }) => {
    // A student whose marks on the competitions they sat are out
    await installHostedBackend(page, 'finished', { areMarksOut: true })

    // A link straight into the thread about their second problem
    await page.goto(
      `${areaPath(CLOSED_COMPETITION_SLUG)}?feedback=${problemIdOf(CLOSED_COMPETITION_SLUG, 2)}`
    )

    // The dialog the thread opens in
    const thread = page.getByRole('dialog', { name: resultsCopy.comments })

    // Open, on that problem
    await expect(
      thread.getByText(areaCopy.problemHeading.replace('{position}', '2'), { exact: true })
    ).toBeVisible({ timeout: SETTLE_TIMEOUT_MS })

    // The thread closed
    await page.keyboard.press('Escape')

    // Which takes it off the address
    await expect(page).toHaveURL(new RegExp(`/mathilding/${CLOSED_COMPETITION_SLUG}$`))

    // The first problem's thread, opened from its row
    await page.getByRole('button', { name: resultsCopy.comments }).first().click()

    // Which the address now names, so the link opens it again
    await expect(page).toHaveURL(
      new RegExp(`\\?feedback=${problemIdOf(CLOSED_COMPETITION_SLUG, 1)}$`)
    )
  })
})
