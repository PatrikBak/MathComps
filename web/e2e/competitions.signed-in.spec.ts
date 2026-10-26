import messages from '../messages/en.json'
import { stubProblemSearch } from './support/backend-routes'
import { areaCopy, areaPath, holdClock, LIST_PATH, showRoundHolding } from './support/competitions'
import { COMPETITION_SLUG, installHostedBackend, PROBLEM_COUNT } from './support/hosted-backend'
import { expect, test } from './support/test'

/** How long the fake backend has to answer before a wait is called a failure. */
const SETTLE_TIMEOUT_MS = 15_000

/** How long something a spec says never happens gets to happen first. */
const LANDING_WINDOW_MS = 1_000

/** The practice run, the one competition anybody gets a second go at. */
const PRACTICE_COMPETITION_SLUG = 'practice-set'

test.describe('the competitions list', () => {
  test('asks a reader with an unfilled profile for the fields a result would name them by', async ({
    page,
  }) => {
    // A student whose profile is missing what a result would name them by
    await installHostedBackend(page, 'gate-blocked')

    // Open the list
    await page.goto(LIST_PATH)

    // Press enter
    await page.getByRole('button', { name: areaCopy.enter, exact: true }).first().click()

    // The reader is pointed at the fields
    await expect(page.getByRole('button', { name: areaCopy.readiness.profileLink })).toBeVisible({
      timeout: SETTLE_TIMEOUT_MS,
    })

    // And no entry opened behind that
    await expect(page.getByRole('dialog')).toHaveCount(0)
  })

  test('holds the first entry ever until the rules are accepted', async ({ page }) => {
    // A student who has never entered anything
    await installHostedBackend(page, 'first-entry')

    // Open the list
    await page.goto(LIST_PATH)

    // Press enter, which opens the dialog the rules are accepted on
    await page.getByRole('button', { name: areaCopy.enter, exact: true }).first().click()

    // The button the clock starts from
    const confirm = page.getByRole('button', { name: areaCopy.dialog.confirm })

    // The button, held shut while the rules are unaccepted
    await expect(confirm).toBeDisabled({ timeout: SETTLE_TIMEOUT_MS })

    // Accept the rules
    await page.getByRole('checkbox').check()

    // And the button opens, the rules being the one thing on the dialog holding it
    await expect(confirm).toBeEnabled()
  })

  test('spends an entry on the problems and starts no clock', async ({ page }) => {
    // A student with an entry still to spend
    await installHostedBackend(page, 'ready')

    // Open the list
    await page.goto(LIST_PATH)

    // Press enter, which opens the dialog
    await page.getByRole('button', { name: areaCopy.enter, exact: true }).first().click()

    // Give the entry up for the problems
    await page.getByRole('button', { name: areaCopy.dialog.forfeit }).click()

    // Confirm giving the entry up, which the dialog asks about first
    await page.getByRole('button', { name: areaCopy.dialog.forfeitConfirm }).click()

    // Inside the area, with the entry named as given up
    await expect(page.getByText(areaCopy.areaForfeited)).toBeVisible({
      timeout: SETTLE_TIMEOUT_MS,
    })

    // And no run-out clock over the problems
    await expect(page.getByText(areaCopy.clockSpent)).toHaveCount(0)
  })

  test('leaves a student who walked away while the entry was landing where they went', async ({
    page,
  }) => {
    // A clock the spec can hold still, so it decides when the entry's answer lands
    await page.clock.install()

    // A student with an entry still to spend
    await installHostedBackend(page, 'ready')

    // The archive's searches answered, so the problems page the walk goes to can draw
    await stubProblemSearch(page, () => null)

    // Open the list
    await page.goto(LIST_PATH)

    // Walk somewhere else, through the app's own navigation so the history entry is a client one
    await page
      .getByRole('link', { name: messages.navigation.problems, exact: true })
      .first()
      .click()

    // Once the problems page is there to walk back from
    await expect(page).toHaveURL(/\/en\/problems/, { timeout: SETTLE_TIMEOUT_MS })

    // Back to the list the same way
    await page.goBack()

    // Press enter, which opens the dialog
    await page.getByRole('button', { name: areaCopy.enter, exact: true }).first().click()

    // The button the entry is confirmed on
    const confirm = page.getByRole('button', { name: areaCopy.dialog.confirm })

    // Once the dialog is there to answer
    await expect(confirm).toBeVisible({ timeout: SETTLE_TIMEOUT_MS })

    // Stop time, so the spec decides when the answer lands
    await holdClock(page)

    // Confirm, which is one round trip the student now waits on
    await confirm.click()

    // The student walks away while that round trip is still out
    await page.goForward()

    // And the answer comes back long after they are gone
    await page.clock.fastForward('00:10')

    // Long enough for a landing to have happened, since what is asserted is that none does: the
    // assertion alone would read the address before the navigation it is meant to catch
    await page.waitForTimeout(LANDING_WINDOW_MS)

    // Still where the student went, the landing never overruling them
    await expect(page).toHaveURL(/\/en\/problems/)
  })

  test('opens the area on the problems the entry paid for, without a second read', async ({
    page,
  }) => {
    // A clock the spec can hold still, so what the press costs is counted in round trips
    await page.clock.install()

    // A student with an entry still to spend
    await installHostedBackend(page, 'ready')

    // Open the list
    await page.goto(LIST_PATH)

    // Press enter, which opens the dialog
    await page.getByRole('button', { name: areaCopy.enter, exact: true }).first().click()

    // The button the entry is confirmed on
    const confirm = page.getByRole('button', { name: areaCopy.dialog.confirm })

    // Once the dialog is there to answer
    await expect(confirm).toBeVisible({ timeout: SETTLE_TIMEOUT_MS })

    // Stop time, so nothing can quietly ride on a second answer
    await holdClock(page)

    // Confirm, which spends the entry and starts the clock
    await confirm.click()

    // Time enough for the entry's answer, the clock held again after it
    await page.clock.fastForward('00:01')

    // The statements on screen, brought back with the entry
    await expect(page.getByRole('article')).toHaveCount(PROBLEM_COUNT, {
      timeout: SETTLE_TIMEOUT_MS,
    })
  })

  test('gives the list up the moment an entry lands, clock and all', async ({ page }) => {
    // A student with an entry still to spend
    await installHostedBackend(page, 'ready')

    // A gate the area's reads wait behind until the spec releases it, which is the window this is about: the
    // entry has landed, its clock is running, and the page the student reads it on has not arrived yet
    let releaseArea = (): void => {}
    const isAreaReleased = new Promise<void>((resolve) => {
      releaseArea = resolve
    })

    // Every read of the area's own route, the one warmed while the dialog was open included
    await page.route(
      (url) => url.pathname === areaPath(COMPETITION_SLUG),
      async (route) => {
        // Held at the gate
        await isAreaReleased

        // Then on to the page
        await route.continue()
      }
    )

    // Open the list
    await page.goto(LIST_PATH)

    // The row of the competition being entered
    const row = page.locator(`[data-competition-slug="${COMPETITION_SLUG}"]`)

    // The row's round, brought into view
    await showRoundHolding(page, row)

    // Press enter, which opens the dialog
    await row.getByRole('button', { name: areaCopy.enter, exact: true }).click()

    // The button the entry is confirmed on
    const confirm = page.getByRole('button', { name: areaCopy.dialog.confirm })

    // Once the dialog is there to answer
    await expect(confirm).toBeVisible({ timeout: SETTLE_TIMEOUT_MS })

    // Confirm, and wait out the entry itself: from here the clock is running and the area is all that is
    // still owed
    await Promise.all([
      page.waitForResponse(
        (response) => response.url().endsWith(`/competitions/${COMPETITION_SLUG}/entry`),
        { timeout: SETTLE_TIMEOUT_MS }
      ),
      confirm.click(),
    ])

    // Long enough for the list to have gone back to being readable, since what is asserted is that it does
    // not: the assertions alone would read the page before the answer they are about has been drawn
    await page.waitForTimeout(LANDING_WINDOW_MS)

    // The row the student pressed is off the page while they wait, since from here it would count their
    // clock down away from the problems
    await expect(row).toHaveCount(0)

    // Nor is the way back into the competition anywhere else on the page
    await expect(page.getByRole('link', { name: areaCopy.continue })).toHaveCount(0)

    // The area arrives
    releaseArea()

    // And the area draws every statement
    await expect(page.getByRole('article')).toHaveCount(PROBLEM_COUNT, {
      timeout: SETTLE_TIMEOUT_MS,
    })
  })

  test('offers the way back into a clock still running, not a second entry', async ({ page }) => {
    // A student already inside one of the competitions
    await installHostedBackend(page, 'running')

    // Open the list
    await page.goto(LIST_PATH)

    // The row of the competition they are actually in
    const row = page.locator(`[data-competition-slug="${COMPETITION_SLUG}"]`)

    // The way back, addressed by where it goes
    const back = row.locator(`a[href="${areaPath(COMPETITION_SLUG)}"]`)

    // The link reads as the way back into the clock
    await expect(back).toHaveText(areaCopy.continue, { timeout: SETTLE_TIMEOUT_MS })

    // And nothing anywhere in that row to take the entry a second time
    await expect(row.getByRole('button')).toHaveCount(0)
  })

  test('offers the way back into a spent practice run, not only a second go at it', async ({
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

    // The practice run's statements, once the entry lands
    await expect(page.getByRole('article').first()).toBeVisible({ timeout: SETTLE_TIMEOUT_MS })

    // Past the minute this run's clock lasts
    await page.clock.fastForward('02:00')

    // Back out to the list
    await page.goto(LIST_PATH)

    // The spent practice run offers the way back into its solutions
    await expect(page.locator(`a[href="${areaPath(PRACTICE_COMPETITION_SLUG)}"]`)).toHaveText(
      areaCopy.mySolutions,
      { timeout: SETTLE_TIMEOUT_MS }
    )

    // And the second go at the practice run is still offered beside the way back
    await expect(page.getByRole('button', { name: areaCopy.tryAgain })).toBeVisible()
  })

  test('has nothing to give up on the practice competition', async ({ page }) => {
    // A student with an entry still to spend
    await installHostedBackend(page, 'ready')

    // Open the list
    await page.goto(LIST_PATH)

    // Press try, which opens the practice run's dialog
    await page.getByRole('button', { name: areaCopy.try }).first().click()

    // The dialog offers the clock
    await expect(page.getByRole('button', { name: areaCopy.dialog.confirm })).toBeVisible({
      timeout: SETTLE_TIMEOUT_MS,
    })

    // And nothing to give up, the practice competition being takeable again
    await expect(page.getByRole('button', { name: areaCopy.dialog.forfeit })).toHaveCount(0)
  })

  test('takes an unfilled profile into the practice run, which publishes no result', async ({
    page,
  }) => {
    // A student whose profile is missing what a result would name them by
    await installHostedBackend(page, 'gate-blocked')

    // Open the list
    await page.goto(LIST_PATH)

    // Press try, which is the practice run
    await page.getByRole('button', { name: areaCopy.try }).first().click()

    // The clock is offered, the fields being wanted for a result the practice run never produces
    await expect(page.getByRole('button', { name: areaCopy.dialog.confirm })).toBeVisible({
      timeout: SETTLE_TIMEOUT_MS,
    })
  })

  test('keeps saying what a graded entry wants after the sentence is hidden', async ({ page }) => {
    // A student whose profile is missing what a result would name them by
    await installHostedBackend(page, 'gate-blocked')

    // Open the list
    await page.goto(LIST_PATH)

    // The way to be rid of the sentence, which only an unfinished profile is offered
    const dismiss = page.getByRole('button', { name: areaCopy.readiness.dismiss })

    // Once the list has drawn the dismiss button
    await expect(dismiss).toBeVisible({ timeout: SETTLE_TIMEOUT_MS })

    // Hide the sentence
    await dismiss.click()

    // And the sentence goes
    await expect(dismiss).toHaveCount(0)

    // Press enter on a graded competition, which is what the fields are actually wanted for
    await page.getByRole('button', { name: areaCopy.enter, exact: true }).first().click()

    // The press still says what the entry wants, so hiding the sentence never leaves a dead button
    await expect(page.getByRole('button', { name: areaCopy.readiness.profileLink })).toBeVisible({
      timeout: SETTLE_TIMEOUT_MS,
    })
  })

  test('leaves the sentence hidden across a reload', async ({ page }) => {
    // A student whose profile is missing what a result would name them by
    await installHostedBackend(page, 'gate-blocked')

    // Open the list
    await page.goto(LIST_PATH)

    // And be rid of the sentence
    await page.getByRole('button', { name: areaCopy.readiness.dismiss }).click()

    // Come back to the page
    await page.reload()

    // Wait for the list itself, so the assertion below is read against a drawn page rather than an empty
    // one, which would pass whether the answer stuck or not
    await expect(page.getByRole('button', { name: areaCopy.try }).first()).toBeVisible({
      timeout: SETTLE_TIMEOUT_MS,
    })

    // And the sentence stays gone after the reload
    await expect(page.getByRole('button', { name: areaCopy.readiness.dismiss })).toHaveCount(0)
  })
})
