import type { Locator, Page } from '@playwright/test'

import type { HarnessGroup } from '@/app/[locale]/dev/addressed-disclosure/addressed-disclosure-harness'
import {
  HARNESS_COPY,
  HARNESS_GROUPS,
  HARNESS_ROUTE,
} from '@/app/[locale]/dev/addressed-disclosure/addressed-disclosure-harness'

import { locationParam } from './support/address'
import { expect, SETTLE_TIMEOUT_MS, test } from './support/test'

/** The dev page showing sets of addressed things with nothing around them, in English. */
const HARNESS_PATH = `/en${HARNESS_ROUTE}`

// The sets on the page, letters and numbers
const [LETTERS, NUMBERS] = HARNESS_GROUPS

/** A parameter no set on the page owns. */
const FOREIGN_PARAM = 'probe'

/**
 * The line saying which of a set's things is open.
 *
 * @param page - The page.
 * @param group - The set.
 *
 * @returns The line.
 */
function statusOf(page: Page, group: HarnessGroup): Locator {
  // The status line inside the set's own section
  return page.getByRole('region', { name: group.title }).getByRole('status')
}

/**
 * Presses one of a set's buttons.
 *
 * @param page - The page.
 * @param group - The set.
 * @param name - The button's name.
 */
async function press(page: Page, group: HarnessGroup, name: string): Promise<void> {
  // The button, inside the set's own section
  await page.getByRole('region', { name: group.title }).getByRole('button', { name }).click()
}

test.describe('an open thing the address names', () => {
  test('opens on what the address names', async ({ page }) => {
    // The page, its address naming a letter
    await page.goto(`${HARNESS_PATH}?${new URLSearchParams({ [LETTERS.param]: 'b' })}`)

    // The letter the address names, open
    await expect(statusOf(page, LETTERS)).toHaveText(HARNESS_COPY.opened('b'), {
      timeout: SETTLE_TIMEOUT_MS,
    })

    // And no number, which the address leaves out
    await expect(statusOf(page, NUMBERS)).toHaveText(HARNESS_COPY.noneOpen)
  })

  test('opens and closes leaving every other parameter on the address as it stands', async ({
    page,
  }) => {
    // The page, its address carrying a parameter no set owns
    await page.goto(`${HARNESS_PATH}?${new URLSearchParams({ [FOREIGN_PARAM]: '1' })}`)

    // A letter, opened
    await press(page, LETTERS, HARNESS_COPY.open('a'))

    // The letter named in the address
    await expect.poll(() => locationParam(page, LETTERS.param)).toBe('a')

    // A number, opened
    await press(page, NUMBERS, HARNESS_COPY.open('2'))

    // The number named in the address
    await expect.poll(() => locationParam(page, NUMBERS.param)).toBe('2')

    // The letter still named beside the number
    expect(await locationParam(page, LETTERS.param)).toBe('a')

    // The letter, closed
    await press(page, LETTERS, HARNESS_COPY.close)

    // The letter gone from the address
    await expect.poll(() => locationParam(page, LETTERS.param)).toBeNull()

    // The number still named
    expect(await locationParam(page, NUMBERS.param)).toBe('2')

    // And the parameter no set owns still there
    expect(await locationParam(page, FOREIGN_PARAM)).toBe('1')
  })

  test('goes back on the address when a link to the page it is on drops it', async ({ page }) => {
    // The page
    await page.goto(HARNESS_PATH)

    // A letter, opened
    await press(page, LETTERS, HARNESS_COPY.open('a'))

    // The letter named in the address
    await expect.poll(() => locationParam(page, LETTERS.param)).toBe('a')

    // How many steps history holds before the link is taken
    const steps = await page.evaluate(() => window.history.length)

    // The page's link to itself, whose address names nothing
    await page.getByRole('link', { name: HARNESS_COPY.thisPage }).click()

    // The link taken, a new step in history
    await expect
      .poll(() => page.evaluate(() => window.history.length), { timeout: SETTLE_TIMEOUT_MS })
      .toBe(steps + 1)

    // The letter named in the address again
    await expect
      .poll(() => locationParam(page, LETTERS.param), { timeout: SETTLE_TIMEOUT_MS })
      .toBe('a')

    // The letter still the one open
    await expect(statusOf(page, LETTERS)).toHaveText(HARNESS_COPY.opened('a'))
  })

  test('opens what the address names after a step back', async ({ page }) => {
    // The page
    await page.goto(HARNESS_PATH)

    // A letter, opened
    await press(page, LETTERS, HARNESS_COPY.open('a'))

    // The letter named in the address
    await expect.poll(() => locationParam(page, LETTERS.param)).toBe('a')

    // How many steps history holds before the link is taken
    const steps = await page.evaluate(() => window.history.length)

    // The page's link to itself, whose address names nothing
    await page.getByRole('link', { name: HARNESS_COPY.thisPage }).click()

    // The link taken, a new step in history
    await expect
      .poll(() => page.evaluate(() => window.history.length), { timeout: SETTLE_TIMEOUT_MS })
      .toBe(steps + 1)

    // The letter put back on the new step's address
    await expect
      .poll(() => locationParam(page, LETTERS.param), { timeout: SETTLE_TIMEOUT_MS })
      .toBe('a')

    // Another letter, opened on the new step
    await press(page, LETTERS, HARNESS_COPY.open('b'))

    // The other letter named in the address
    await expect.poll(() => locationParam(page, LETTERS.param)).toBe('b')

    // A step back, to the address naming the first letter
    await page.goBack()

    // The first letter open again
    await expect(statusOf(page, LETTERS)).toHaveText(HARNESS_COPY.opened('a'), {
      timeout: SETTLE_TIMEOUT_MS,
    })

    // And the address still naming the first letter
    expect(await locationParam(page, LETTERS.param)).toBe('a')
  })
})
