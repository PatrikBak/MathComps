import { areaCopy, areaPath, modalCopy } from './support/competitions'
import { COMPETITION_SLUG, installHostedBackend, PROBLEM_COUNT } from './support/hosted-backend'
import { expect, test } from './support/test'

/** How long the fake backend has to answer before a wait is called a failure. */
const SETTLE_TIMEOUT_MS = 15_000

/**
 * How the first problem's first hint reads, which is prose rather than maths so a single string finds it
 * however KaTeX sets the rest of the sentence.
 */
const FIRST_HINT = 'Try small values'

/** How the same problem's second hint ends, prose again, which tells the two rungs apart. */
const SECOND_HINT = 'between two squares'

/** How the first problem's own statement opens, prose again for the same reason. */
const STATEMENT_OPENING = 'Find all pairs of positive integers'

/** How the first problem's official solution opens, which the hints modal must not be showing. */
const SOLUTION_OPENING = 'Assume without loss of generality'

test.describe("the author's hints", () => {
  test('offers no hints while the clock is running', async ({ page }) => {
    // A student forty minutes into a two-hour clock
    await installHostedBackend(page, 'running')

    // Open its area
    await page.goto(areaPath(COMPETITION_SLUG))

    // Once the whole set is drawn
    await expect(page.getByRole('article')).toHaveCount(PROBLEM_COUNT, {
      timeout: SETTLE_TIMEOUT_MS,
    })

    // Nothing offers the ladder up to an answer
    await expect(page.getByRole('button', { name: areaCopy.hints, exact: true })).toHaveCount(0)

    // Nor is a rung sitting unopened in the page, where the browser's own devtools would reach it
    await expect(page.getByText(FIRST_HINT)).toHaveCount(0)
  })

  test('reads the ladder a rung at a time once the entry is given up', async ({ page }) => {
    // A student who gave the entry up half an hour ago to read the problems
    await installHostedBackend(page, 'forfeited')

    // Open its area
    await page.goto(areaPath(COMPETITION_SLUG))

    // The one problem of the set the author wrote a ladder for now offers it
    await expect(page.getByRole('button', { name: areaCopy.hints, exact: true })).toHaveCount(1, {
      timeout: SETTLE_TIMEOUT_MS,
    })

    // Held back until asked for, so arriving never nudges somebody still thinking
    await expect(page.getByText(FIRST_HINT)).toHaveCount(0)

    // Asked for
    await page.getByRole('button', { name: areaCopy.hints, exact: true }).click()

    // Which opens the ladder on a surface of its own
    const hints = page.getByRole('dialog')

    // Carrying the problem it leads to, up where a conversation about the same problem carries it
    await expect(hints.getByText(STATEMENT_OPENING)).toBeVisible()

    // A rung per hint, each labelled as one and still folded away, so reading the first costs nothing of
    // the second
    await expect(hints.locator('summary')).toHaveCount(2)
    await expect(hints.locator('summary').first()).toContainText(areaCopy.hint)
    await expect(hints.getByText(FIRST_HINT)).toBeHidden()

    // The first, unfolded on its own, the second staying folded behind it
    await hints.locator('summary').first().click()
    await expect(hints.getByText(FIRST_HINT)).toBeVisible()
    await expect(hints.getByText(SECOND_HINT)).toBeHidden()

    // And the solution it leads towards is not on this surface
    await expect(hints.getByText(SOLUTION_OPENING)).toHaveCount(0)

    // Closed again
    await hints.getByRole('button', { name: modalCopy.close }).click()

    // And the ladder is off the set
    await expect(page.getByText(FIRST_HINT)).toHaveCount(0)
  })

  test('draws no row on a problem the author wrote no ladder for', async ({ page }) => {
    // A student who gave the entry up, so everything the run held back is open
    await installHostedBackend(page, 'forfeited')

    // Open its area
    await page.goto(areaPath(COMPETITION_SLUG))

    // Every problem offers its solution
    await expect(
      page.getByRole('button', { name: areaCopy.officialSolution, exact: true })
    ).toHaveCount(PROBLEM_COUNT, { timeout: SETTLE_TIMEOUT_MS })

    // And only the one the author wrote a ladder for offers hints, a ladder being optional
    await expect(page.getByRole('button', { name: areaCopy.hints, exact: true })).toHaveCount(1)
  })

  test('carries an open ladder in the address, so the link opens it again', async ({ page }) => {
    // A student who gave the entry up half an hour ago to read the problems
    await installHostedBackend(page, 'forfeited')

    // Open its area
    await page.goto(areaPath(COMPETITION_SLUG))

    // Once the ladder is offered
    await expect(page.getByRole('button', { name: areaCopy.hints, exact: true })).toHaveCount(1, {
      timeout: SETTLE_TIMEOUT_MS,
    })

    // Asked for
    await page.getByRole('button', { name: areaCopy.hints, exact: true }).click()

    // Which the address now names, by the place the problem sits in the set
    await expect(page).toHaveURL(/\?hints=1$/)

    // Followed as somebody else would follow it
    await page.reload()

    // Where it opens on the problem it named, before anything has been clicked
    const hints = page.getByRole('dialog')
    await expect(hints.getByText(STATEMENT_OPENING)).toBeVisible({ timeout: SETTLE_TIMEOUT_MS })

    // With its rungs
    await expect(hints.locator('summary')).toHaveCount(2)

    // Closed again
    await hints.getByRole('button', { name: modalCopy.close }).click()

    // Which takes it back off the address
    await expect(page).not.toHaveURL(/hints=/)
  })

  test('reads the hints and the solution one surface at a time', async ({ page }) => {
    // A student who gave the entry up, so both surfaces are open to them
    await installHostedBackend(page, 'forfeited')

    // Open its area
    await page.goto(areaPath(COMPETITION_SLUG))

    // Once the ladder is offered
    await expect(page.getByRole('button', { name: areaCopy.hints, exact: true })).toHaveCount(1, {
      timeout: SETTLE_TIMEOUT_MS,
    })

    // Asked for
    await page.getByRole('button', { name: areaCopy.hints, exact: true }).click()

    // Which is the surface on screen
    await expect(page.getByRole('dialog')).toHaveCount(1)

    // Closed
    await page.getByRole('dialog').getByRole('button', { name: modalCopy.close }).click()

    // And the solution to the same problem asked for instead
    await page.getByRole('button', { name: areaCopy.officialSolution, exact: true }).first().click()

    // Still one surface
    await expect(page.getByRole('dialog')).toHaveCount(1)

    // Showing the solution
    await expect(page.getByRole('dialog').getByText(SOLUTION_OPENING)).toBeVisible()

    // And the address names the solution alone
    await expect(page).toHaveURL(/\?solution=1$/)
  })

  test('opens the ladder the moment the clock runs out under a reader watching it', async ({
    page,
  }) => {
    // A clock the spec can walk forward, this entry starting with time still on it
    await page.clock.install()

    // An entry with ninety seconds left on it
    await installHostedBackend(page, 'expiring')

    // Open its area
    await page.goto(areaPath(COMPETITION_SLUG))

    // Which draws the set while the entry still counts
    await expect(page.getByRole('article')).toHaveCount(PROBLEM_COUNT, {
      timeout: SETTLE_TIMEOUT_MS,
    })

    // So nothing is offered yet
    await expect(page.getByRole('button', { name: areaCopy.hints, exact: true })).toHaveCount(0)

    // Past the ninety seconds this state leaves on the clock
    await page.clock.fastForward('02:00')

    // And the ladder arrives with nobody reloading the page or pressing anything on it
    await expect(page.getByRole('button', { name: areaCopy.hints, exact: true })).toHaveCount(1, {
      timeout: SETTLE_TIMEOUT_MS,
    })
  })
})
