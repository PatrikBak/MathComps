import { expect, test } from '@playwright/test'

import {
  areaCopy,
  COMPETITION_ID,
  holdClock,
  listPath,
  PROBLEM_COUNT,
  SIGNED_OUT_SCENARIO,
} from './support/competitions'

/** How long the mocked backend has to answer before a wait is called a failure. */
const SETTLE_TIMEOUT_MS = 15_000

/** How long a landing gets to happen before a spec is willing to say none did. */
const LANDING_WINDOW_MS = 1_000

test.describe('the competitions list', () => {
  test('asks a reader with no account for one rather than opening the entry', async ({ page }) => {
    // The list, read by somebody with no account
    await page.goto(listPath(SIGNED_OUT_SCENARIO))

    // Which says up front what an entry would need of them
    await expect(page.getByText('You can compete once you')).toBeVisible({
      timeout: SETTLE_TIMEOUT_MS,
    })

    // The press, which keeps the same word whatever stands in the way
    await page.getByRole('button', { name: areaCopy.enter, exact: true }).first().click()

    // The prompt, and no clock anywhere near starting
    await expect(page.getByText(/You must log in to/)).toBeVisible()
    await expect(page.getByRole('dialog')).toHaveCount(0)
  })

  test('asks a reader with an unfilled profile for the fields a result would name them by', async ({
    page,
  }) => {
    // The list, read by somebody whose profile is missing what a result would name them by
    await page.goto(listPath('gate-blocked'))

    // The press, which asks for the fields before the clock rather than after it is spent
    await page.getByRole('button', { name: areaCopy.enter, exact: true }).first().click()

    // The way to the fields, and again no entry opening behind it
    await expect(page.getByRole('button', { name: areaCopy.readiness.profileLink })).toBeVisible({
      timeout: SETTLE_TIMEOUT_MS,
    })
    await expect(page.getByRole('dialog')).toHaveCount(0)
  })

  test('holds the first entry ever until the rules are accepted', async ({ page }) => {
    // The list, read by somebody who has never entered anything
    await page.goto(listPath('first-entry'))

    // The press, which opens the dialog the rules are accepted on
    await page.getByRole('button', { name: areaCopy.enter, exact: true }).first().click()

    // The button the clock starts from
    const confirm = page.getByRole('button', { name: areaCopy.dialog.confirm })

    // Held until the rules are accepted, which is asked once ever
    await expect(confirm).toBeDisabled({ timeout: SETTLE_TIMEOUT_MS })

    // Accepting them
    await page.getByRole('checkbox').check()

    // Which is the one thing on the dialog that was holding it
    await expect(confirm).toBeEnabled()
  })

  test('spends an entry on the problems and starts no clock', async ({ page }) => {
    // The list, with an entry still to spend
    await page.goto(listPath('ready'))

    // The press that opens the dialog
    await page.getByRole('button', { name: areaCopy.enter, exact: true }).first().click()

    // Its third way through: the problems now, and no result ever
    await page.getByRole('button', { name: areaCopy.dialog.forfeit }).click()

    // Which is asked about before it happens
    await page.getByRole('button', { name: areaCopy.dialog.forfeitConfirm }).click()

    // Inside, where the problems are, with the entry named as given up rather than sat
    await expect(page.getByText(areaCopy.areaForfeited)).toBeVisible({
      timeout: SETTLE_TIMEOUT_MS,
    })

    // And no clock over any of it, which is the whole of what the press cost
    await expect(page.getByText(areaCopy.clockSpent)).toHaveCount(0)
  })

  test('leaves a student who walked away while the entry was landing where they went', async ({
    page,
  }) => {
    // A clock the spec can hold still, the window being the one between the press and the answer
    await page.clock.install()

    // The list
    await page.goto(listPath('ready'))

    // Somewhere else to walk to, reached through the app's own navigation rather than a fresh load
    await page.getByRole('link', { name: 'Problems', exact: true }).first().click()

    // Once it is there to walk back from
    await expect(page).toHaveURL(/\/en\/problems/, { timeout: SETTLE_TIMEOUT_MS })

    // And back to the list the same way
    await page.goBack()

    // The press that spends the entry
    await page.getByRole('button', { name: areaCopy.enter, exact: true }).first().click()

    // Once the dialog is there to answer
    const confirm = page.getByRole('button', { name: areaCopy.dialog.confirm })
    await expect(confirm).toBeVisible({ timeout: SETTLE_TIMEOUT_MS })

    // Time stops here, so the spec decides when the answer lands
    await holdClock(page)

    // Confirmed, which is one round trip the student now waits on
    await confirm.click()

    // The student walks away while it is still out
    await page.goForward()

    // And it comes back long after they are gone
    await page.clock.fastForward('00:10')

    // Long enough for a landing to have happened, since what is being asserted is that none does: the
    // assertion alone would read the address before the navigation it is meant to catch
    await page.waitForTimeout(LANDING_WINDOW_MS)

    // Still where they went, the landing never overruling them
    await expect(page).toHaveURL(/\/en\/problems/)
  })

  test('opens the area on the problems the entry paid for, without a second read', async ({
    page,
  }) => {
    // A clock the spec can hold still, so what the press costs is counted in round trips
    await page.clock.install()

    // The list, with an entry still to spend
    await page.goto(listPath('ready'))

    // The press that opens the dialog
    await page.getByRole('button', { name: areaCopy.enter, exact: true }).first().click()

    // Once it is there to answer
    const confirm = page.getByRole('button', { name: areaCopy.dialog.confirm })
    await expect(confirm).toBeVisible({ timeout: SETTLE_TIMEOUT_MS })

    // Time stops here, and moves once, so nothing can quietly ride on a second answer
    await holdClock(page)

    // The press that spends the entry and starts the clock
    await confirm.click()

    // One answer's worth of time, and no more
    await page.clock.fastForward('00:01')

    // Which is enough to be reading the statements, the entry having brought them back with it
    await expect(page.getByRole('article')).toHaveCount(PROBLEM_COUNT, {
      timeout: SETTLE_TIMEOUT_MS,
    })
  })

  test('offers the way back into a clock still running, not a second entry', async ({ page }) => {
    // The list, read by a student already inside one of the competitions
    await page.goto(listPath('running'))

    // The row of the competition they are actually in
    const row = page.locator(`[data-competition-id="${COMPETITION_ID}"]`)

    // The way back, addressed by where it goes, with the scenario riding along since the area reads its
    // whole identity off that
    const back = row.locator(`a[href="/en/competitions/${COMPETITION_ID}?scenario=running"]`)
    await expect(back).toHaveText(areaCopy.continue, { timeout: SETTLE_TIMEOUT_MS })

    // And nothing anywhere in that row to take the entry a second time
    await expect(row.getByRole('button')).toHaveCount(0)
  })

  test('has nothing to give up on the practice competition', async ({ page }) => {
    // The list
    await page.goto(listPath('ready'))

    // The press that opens the practice run's dialog
    await page.getByRole('button', { name: areaCopy.try }).first().click()

    // Which offers the clock
    await expect(page.getByRole('button', { name: areaCopy.dialog.confirm })).toBeVisible({
      timeout: SETTLE_TIMEOUT_MS,
    })

    // And nothing to give up, the practice competition being takeable again
    await expect(page.getByRole('button', { name: areaCopy.dialog.forfeit })).toHaveCount(0)
  })
})
