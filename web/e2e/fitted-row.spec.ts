import type { Page } from '@playwright/test'

import messages from '../messages/en.json'
import {
  filtersCopy,
  NARROW_BAR_WINDOW,
  openArchive,
  WIDE_BAR_WINDOW,
} from './support/archive-filters'
import { expect, test } from './support/test'

/** How much narrower the window gets at each step from the wide one to the narrow one, in pixels. */
const NARROWING_STEP_PX = 40

/**
 * One action of the bar, as the bar and its overflow menu each name it.
 */
type BarActionNames = {
  /** The action's name on the bar. */
  onBar: string
  /** The action's name in the overflow menu. */
  inMenu: string
}

/** The bar's actions that can leave it, in the order they stand on it. */
const ACTIONS: BarActionNames[] = [
  { onBar: filtersCopy.markStatus, inMenu: filtersCopy.markStatus },
  { onBar: filtersCopy.competitions, inMenu: filtersCopy.competitionsOverview },
  { onBar: messages.problems.cardView.label, inMenu: messages.problems.cardView.label },
  { onBar: messages.ui.actions.share, inMenu: messages.ui.actions.share },
]

/**
 * Reads which of the bar's actions stand on the bar.
 *
 * @param page - The page showing the archive.
 * @returns The actions on the bar, in the order of {@link ACTIONS}.
 */
async function actionsOnBar(page: Page): Promise<BarActionNames[]> {
  // The row the actions stand on, which ends in the reset
  const row = page.getByRole('button', { name: filtersCopy.resetFilters }).locator('..')

  // Whether each action has a button on it
  const isOnBar = await Promise.all(
    ACTIONS.map((action) =>
      row.getByRole('button', { name: action.onBar, exact: true }).isVisible()
    )
  )

  // The actions that do
  return ACTIONS.filter((_action, index) => isOnBar[index])
}

/**
 * Reads what the overflow menu lists, opening it and closing it again.
 *
 * @param page - The page showing the archive.
 * @returns The name of each choice and row the menu lists, in the order it lists them.
 */
async function overflowMenuNames(page: Page): Promise<string[]> {
  // The overflow menu, opened from its trigger
  await page.getByRole('button', { name: messages.problems.moreActions }).click()

  // The menu, once it shows
  const menu = page.getByRole('menu')
  await expect(menu).toBeVisible()

  // Each choice by the heading naming its group, each other row by its text, in the order the menu holds them
  const names = await menu.evaluate((menuElement) =>
    [...menuElement.querySelectorAll('[role="group"], [role="menuitem"]')].map((entry) => {
      // The id of the heading naming a choice's group, none on any other row
      const headingId = entry.getAttribute('aria-labelledby')

      // The heading's text, or the row's own
      return (headingId ? document.getElementById(headingId) : entry)?.textContent?.trim() ?? ''
    })
  )

  // Closed again
  await page.keyboard.press('Escape')
  await expect(menu).toHaveCount(0)

  // What the menu listed
  return names
}

test.describe('fitted row', () => {
  test('moves the actions it has no room for into the menu from the last, and brings them back', async ({
    page,
  }) => {
    // The archive in a window with room for every action
    await page.setViewportSize(WIDE_BAR_WINDOW)
    await openArchive(page)

    // Every action on the bar
    await expect.poll(() => actionsOnBar(page)).toEqual(ACTIONS)

    // What the menu lists at that width
    const menuAtWide = await overflowMenuNames(page)

    // None of the actions among it
    expect(ACTIONS.filter((action) => menuAtWide.includes(action.inMenu))).toEqual([])

    // How many actions the bar holds at each width
    const counts: number[] = []

    // The window narrowed a step at a time, from the wide window to the narrow one
    for (
      let width = WIDE_BAR_WINDOW.width;
      width >= NARROW_BAR_WINDOW.width;
      width -= NARROWING_STEP_PX
    ) {
      // The window at this width, given a moment for the actions to settle
      await page.setViewportSize({ ...NARROW_BAR_WINDOW, width })
      await page.waitForTimeout(100)

      // The actions on the bar at this width
      const onBarHere = await actionsOnBar(page)

      // Always the first ones, the last having left first
      expect(onBarHere).toEqual(ACTIONS.slice(0, onBarHere.length))

      // Their count, kept for after the loop
      counts.push(onBarHere.length)
    }

    // Somewhere the bar held some of them but not all, which is where the order showed
    expect(counts.some((count) => count > 0 && count < ACTIONS.length)).toBe(true)

    // The actions still on the bar at the narrowest
    const onBar = await actionsOnBar(page)

    // The actions the menu lists, its other rows cut off
    const inMenu = (await overflowMenuNames(page)).slice(0, ACTIONS.length - onBar.length)

    // The ones on the bar lead, the menu's following in the same order
    expect([...onBar.map((action) => action.inMenu), ...inMenu]).toEqual(
      ACTIONS.map((action) => action.inMenu)
    )

    // The reset kept on the bar
    await expect(page.getByRole('button', { name: filtersCopy.resetFilters })).toBeVisible()

    // The window widened again
    await page.setViewportSize(WIDE_BAR_WINDOW)

    // Every action back on the bar
    await expect.poll(() => actionsOnBar(page)).toEqual(ACTIONS)
  })
})
