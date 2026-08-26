import { expect, test } from '@playwright/test'

import { areaCopy, holdClock, LIST_PATH } from './support/competitions'
import { COMPETITION_ID, installHostedBackend, PROBLEM_COUNT } from './support/hosted-backend'

/** How long the fake backend has to answer before a wait is called a failure. */
const SETTLE_TIMEOUT_MS = 15_000

/** How long a landing gets to happen before a spec is willing to say none did. */
const LANDING_WINDOW_MS = 1_000

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

    // Which is held shut while the rules are unaccepted
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

    // Which is asked about before it happens
    await page.getByRole('button', { name: areaCopy.dialog.forfeitConfirm }).click()

    // Inside the area, with the entry named as given up
    await expect(page.getByText(areaCopy.areaForfeited)).toBeVisible({
      timeout: SETTLE_TIMEOUT_MS,
    })

    // And no clock over any of it
    await expect(page.getByText(areaCopy.clockSpent)).toHaveCount(0)
  })

  test('leaves a student who walked away while the entry was landing where they went', async ({
    page,
  }) => {
    // A clock the spec can hold still, so it decides when the entry's answer lands
    await page.clock.install()

    // A student with an entry still to spend
    await installHostedBackend(page, 'ready')

    // Open the list
    await page.goto(LIST_PATH)

    // Walk somewhere else, through the app's own navigation so the history entry is a client one
    await page.getByRole('link', { name: 'Problems', exact: true }).first().click()

    // Once the problems page is there to walk back from
    await expect(page).toHaveURL(/\/en\/problems/, { timeout: SETTLE_TIMEOUT_MS })

    // Back to the list the same way
    await page.goBack()

    // Press enter, which spends the entry
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

    // One answer's worth of time, and no more
    await page.clock.fastForward('00:01')

    // Which is enough to be reading the statements, the entry having brought them back with it
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
    const row = page.locator(`[data-competition-id="${COMPETITION_ID}"]`)

    // The way back, addressed by where it goes
    const back = row.locator(`a[href="/en/competitions/${COMPETITION_ID}"]`)

    // Which reads as a way back into the clock
    await expect(back).toHaveText(areaCopy.continue, { timeout: SETTLE_TIMEOUT_MS })

    // And nothing anywhere in that row to take the entry a second time
    await expect(row.getByRole('button')).toHaveCount(0)
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
    await expect(dismiss).toBeVisible({ timeout: SETTLE_TIMEOUT_MS })

    // Take it
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

    // And it stays gone, the answer having been kept against the account rather than the tab
    await expect(page.getByRole('button', { name: areaCopy.readiness.dismiss })).toHaveCount(0)
  })
})
