import { areaCopy, areaPath, LIST_PATH, modalCopy } from './support/competitions'
import { COMPETITION_SLUG, installHostedBackend, PROBLEM_COUNT } from './support/hosted-backend'
import { expect, test } from './support/test'

/** How long the fake backend has to answer before a wait is called a failure. */
const SETTLE_TIMEOUT_MS = 15_000

/** A competition that closed a month ago, which a newcomer has no entry on and may still read. */
const CLOSED_COMPETITION_SLUG = 'closed-special-set'

/**
 * How the first problem's official solution opens, which is prose rather than maths so a single string
 * finds it however KaTeX sets the rest of the sentence.
 */
const SOLUTION_OPENING = 'Assume without loss of generality'

/**
 * How the first problem's own statement opens, prose again so a single string finds it however KaTeX sets
 * the rest of the sentence.
 */
const STATEMENT_OPENING = 'Find all pairs of positive integers'

/**
 * How the second problem's official solution opens, which tells the two apart wherever a link is meant to
 * have picked one of them out.
 */
const SECOND_SOLUTION_OPENING = 'lie on the circle with diameter'

test.describe('the official solutions', () => {
  test('offers no solution while the clock is running', async ({ page }) => {
    // A student forty minutes into a two-hour clock
    await installHostedBackend(page, 'running')

    // Open its area
    await page.goto(areaPath(COMPETITION_SLUG))

    // Once the whole set is drawn
    await expect(page.getByRole('article')).toHaveCount(PROBLEM_COUNT, {
      timeout: SETTLE_TIMEOUT_MS,
    })

    // Nothing offers what a problem is measured against
    await expect(
      page.getByRole('button', { name: areaCopy.officialSolution, exact: true })
    ).toHaveCount(0)

    // Nor is one sitting unopened in the page, where the browser's own devtools would reach it
    await expect(page.getByText(SOLUTION_OPENING)).toHaveCount(0)
  })

  test('reads the solution on a surface of its own once the entry is given up', async ({
    page,
  }) => {
    // A student who gave the entry up half an hour ago to read the problems
    await installHostedBackend(page, 'forfeited')

    // Open its area
    await page.goto(areaPath(COMPETITION_SLUG))

    // Every problem now offers one
    await expect(
      page.getByRole('button', { name: areaCopy.officialSolution, exact: true })
    ).toHaveCount(PROBLEM_COUNT, {
      timeout: SETTLE_TIMEOUT_MS,
    })

    // Held back until asked for, so arriving does not put the answer in front of somebody who wants
    // another go at the problem first
    await expect(page.getByText(SOLUTION_OPENING)).toHaveCount(0)

    // Asked for on the first problem
    await page.getByRole('button', { name: areaCopy.officialSolution, exact: true }).first().click()

    // Which opens it on a surface of its own
    const solution = page.getByRole('dialog')

    // Where the solution is
    await expect(solution.getByText(SOLUTION_OPENING)).toBeVisible()

    // Carrying the problem it answers, up where a conversation about the same problem carries it, so
    // following the argument never costs the statement
    await expect(solution.getByText(STATEMENT_OPENING)).toBeVisible()

    // Closed again
    await solution.getByRole('button', { name: modalCopy.close }).click()

    // And the solution is off the set
    await expect(page.getByText(SOLUTION_OPENING)).toHaveCount(0)
  })

  test('carries an open solution in the address, so the link opens it again', async ({ page }) => {
    // A student who gave the entry up half an hour ago to read the problems
    await installHostedBackend(page, 'forfeited')

    // Open its area
    await page.goto(areaPath(COMPETITION_SLUG))

    // Once every problem offers one
    await expect(
      page.getByRole('button', { name: areaCopy.officialSolution, exact: true })
    ).toHaveCount(PROBLEM_COUNT, {
      timeout: SETTLE_TIMEOUT_MS,
    })

    // The second problem's, asked for
    await page.getByRole('button', { name: areaCopy.officialSolution, exact: true }).nth(1).click()

    // Which the address now names, by the place the problem sits in the set
    await expect(page).toHaveURL(/\?solution=2$/)

    // Followed as somebody else would follow it
    await page.reload()

    // Where it opens on the problem it named, before anything has been clicked
    const solution = page.getByRole('dialog')
    await expect(solution.getByText(SECOND_SOLUTION_OPENING)).toBeVisible({
      timeout: SETTLE_TIMEOUT_MS,
    })

    // And on that one alone
    await expect(solution.getByText(SOLUTION_OPENING)).toHaveCount(0)

    // Closed again
    await solution.getByRole('button', { name: modalCopy.close }).click()

    // Which takes it back off the address, so a reload lands on the set rather than back inside it
    await expect(page).not.toHaveURL(/solution=/)
  })

  test('opens the solutions the moment the clock runs out under a reader watching it', async ({
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
    await expect(
      page.getByRole('button', { name: areaCopy.officialSolution, exact: true })
    ).toHaveCount(0)

    // Past the ninety seconds this state leaves on the clock
    await page.clock.fastForward('02:00')

    // And the official solutions arrive with nobody reloading the page or pressing anything on it
    await expect(
      page.getByRole('button', { name: areaCopy.officialSolution, exact: true })
    ).toHaveCount(PROBLEM_COUNT, {
      timeout: SETTLE_TIMEOUT_MS,
    })
  })

  test('opens the solutions where the student hands in, without taking them off the set', async ({
    page,
  }) => {
    // A student forty minutes into a two-hour clock
    await installHostedBackend(page, 'running')

    // Open its area
    await page.goto(areaPath(COMPETITION_SLUG))

    // Once the whole set is drawn
    await expect(page.getByRole('article')).toHaveCount(PROBLEM_COUNT, {
      timeout: SETTLE_TIMEOUT_MS,
    })

    // Nothing is offered while the clock counts
    await expect(
      page.getByRole('button', { name: areaCopy.officialSolution, exact: true })
    ).toHaveCount(0)

    // Hand it in ahead of its own clock
    await page.getByRole('button', { name: areaCopy.finishEntry }).click()

    // Which is asked about before it happens
    await page.getByRole('button', { name: areaCopy.finishDialog.confirm, exact: true }).click()

    // And the official solutions arrive
    await expect(
      page.getByRole('button', { name: areaCopy.officialSolution, exact: true })
    ).toHaveCount(PROBLEM_COUNT, { timeout: SETTLE_TIMEOUT_MS })

    // On the set the student just argued, which is the page they were already on
    await expect(page).toHaveURL(new RegExp(`/mathilding/${COMPETITION_SLUG}$`))
  })

  test('closes the solutions again when the practice run is taken a second time', async ({
    page,
  }) => {
    // A clock the spec can walk forward
    await page.clock.install()

    // And a student with an entry still to spend
    await installHostedBackend(page, 'ready')

    // Open the list
    await page.goto(LIST_PATH)

    // Press try
    await page.getByRole('button', { name: areaCopy.try }).first().click()

    // And confirm the dialog
    await page.getByRole('button', { name: areaCopy.dialog.confirm }).click()

    // Which lands on the set the run is spent on
    await expect(page.getByRole('article')).toHaveCount(PROBLEM_COUNT, {
      timeout: SETTLE_TIMEOUT_MS,
    })

    // Past the minute this run's clock lasts
    await page.clock.fastForward('02:00')

    // Which opens the official solutions
    await expect(
      page.getByRole('button', { name: areaCopy.officialSolution, exact: true })
    ).toHaveCount(PROBLEM_COUNT, { timeout: SETTLE_TIMEOUT_MS })

    // Then back out to the list
    await page.goto(LIST_PATH)

    // Where taking it again starts a fresh clock over the same problems
    await page.getByRole('button', { name: areaCopy.tryAgain }).click()

    // Confirmed the same way
    await page.getByRole('button', { name: areaCopy.dialog.confirm }).click()

    // Back on the set
    await expect(page.getByRole('article')).toHaveCount(PROBLEM_COUNT, {
      timeout: SETTLE_TIMEOUT_MS,
    })

    // With nothing to measure it against, the run just started being one they are competing in
    await expect(
      page.getByRole('button', { name: areaCopy.officialSolution, exact: true })
    ).toHaveCount(0)

    // And what the last run opened is gone from the page rather than sitting in it unopened
    await expect(page.getByText(SOLUTION_OPENING)).toHaveCount(0)
  })

  test('reads a closed competition it was never in, solutions and all', async ({ page }) => {
    // A student who has entered nothing at all, so the competition that closed a month ago is one they
    // watched from the outside
    await installHostedBackend(page, 'first-entry')

    // Open the list, where that competition offers its problems
    await page.goto(LIST_PATH)

    // The one link it leaves a reader who was never in it
    const problems = page.locator(`a[href="/en/mathilding/${CLOSED_COMPETITION_SLUG}"]`)

    // Which reads as the offer of the problems
    await expect(problems).toHaveText(areaCopy.problems, { timeout: SETTLE_TIMEOUT_MS })

    // And goes to the area
    await problems.click()

    // Where the whole set is drawn, no entry having been spent on any of it
    await expect(page.getByRole('article')).toHaveCount(PROBLEM_COUNT, {
      timeout: SETTLE_TIMEOUT_MS,
    })

    // With the official solutions beside the problems, nobody being able to still be competing here
    await expect(
      page.getByRole('button', { name: areaCopy.officialSolution, exact: true })
    ).toHaveCount(PROBLEM_COUNT)

    // And nothing to hand in, there being no entry of theirs to close
    await expect(page.getByRole('button', { name: areaCopy.finishEntry })).toHaveCount(0)
  })
})
