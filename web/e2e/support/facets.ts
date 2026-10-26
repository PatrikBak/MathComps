import type { Locator, Page } from '@playwright/test'

import { FACET_ROW_ATTRIBUTE } from '@/components/shared/components/facets/hooks/use-facet-row-navigation'

import { facetsCopy, filtersInUrl } from './archive-filters'
import { expect } from './test'

/** How many times Tab is pressed walking through a panel at most, which is more stops than any panel holds. */
const TAB_WALK_LIMIT = 10

/** What a Tab walk records for a stop inside a facet's list that is not one of its rows. */
const NON_ROW_STOP = '(not a row)'

/**
 * How long to wait before calling an outcome final: long enough for anything a press or an answer still owes the
 * page to land. A check that something did NOT happen needs a window like this, or it only proves the thing was slow.
 */
export const QUIET_MS = 1000

/**
 * The button opening a facet, in the words the reader is given.
 *
 * @param page - The page.
 * @param title - The facet's name.
 *
 * @returns The button.
 */
export function triggerOf(page: Page, title: string): Locator {
  // Named after the facet it opens
  return page.getByRole('button', {
    name: facetsCopy.openPopover.replace('{name}', title.toLowerCase()),
  })
}

/**
 * The reset beside a facet's heading, above its trigger.
 *
 * @param page - The page.
 * @param title - The facet's name.
 *
 * @returns The button.
 */
export function headingResetOf(page: Page, title: string): Locator {
  // Named after the facet it resets
  return page.getByRole('button', { name: facetsCopy.resetSelection.replace('{name}', title) })
}

/**
 * The reset inside a facet's open panel, which the panel carries where no heading shows above it.
 *
 * @param panel - The open panel.
 *
 * @returns The button.
 */
export function panelResetOf(panel: Locator): Locator {
  // Named for whichever filter it sits in, the panel naming the facet itself
  return panel.getByRole('button', { name: facetsCopy.resetFilter })
}

/**
 * Opens a facet and waits for its panel, with focus inside it.
 *
 * @param page - The page.
 * @param title - The facet's name.
 *
 * @returns The open panel.
 */
export async function openFacet(page: Page, title: string): Promise<Locator> {
  // Open it
  await triggerOf(page, title).click()

  // The panel, named after the facet
  const panel = page.getByRole('dialog', { name: title })

  // Once its rows are drawn
  await expect(panel.locator(FACET_ROW_ATTRIBUTE.anySelector).first()).toBeVisible()

  // And focus has followed, which the panel hands it a frame after it appears, a key pressed sooner going to
  // the trigger
  await expect.poll(() => isFocusInPanel(panel)).toBe(true)

  // Which is what the test goes on to work in
  return panel
}

/**
 * The id of the row holding focus.
 *
 * @param page - The page.
 *
 * @returns The focused row's id, or null where focus sits on no row.
 */
export async function focusedRowId(page: Page): Promise<string | null> {
  // Read off whatever the document says is focused
  return page.evaluate(
    (attribute) => document.activeElement?.getAttribute(attribute) ?? null,
    FACET_ROW_ATTRIBUTE.name
  )
}

/**
 * Whether focus sits inside a facet's open panel, or a part of it.
 *
 * @param panel - The open panel, or a part of it.
 *
 * @returns True while it does.
 */
export async function isFocusInPanel(panel: Locator): Promise<boolean> {
  // The panel holding whatever is focused, read without waiting since focus leaving it closes it
  return panel.evaluateAll((panels) =>
    panels.some((element) => element.contains(document.activeElement))
  )
}

/**
 * Tabs through an open facet's panel from wherever focus sits in it, until focus leaves it.
 *
 * @param page - The page.
 * @param panel - The open panel.
 *
 * @returns The stops Tab made among the rows, in order: a row's id, or {@link NON_ROW_STOP} for anything else in
 * the list.
 */
export async function rowTabStops(page: Page, panel: Locator): Promise<string[]> {
  // Every stop Tab makes among the rows as it goes through the panel, which it leaves once past its last stop
  const stops: string[] = []

  // The list holding the rows, a group of options or a tree
  const list = panel.locator('[role="group"], [role="tree"]')

  // Tab through the panel, no further than one stop per control it could hold
  for (let press = 0; press < TAB_WALK_LIMIT; press++) {
    // On to the next stop
    await page.keyboard.press('Tab')

    // Out of the panel, which ends the walk
    if (!(await isFocusInPanel(panel))) return stops

    // The row it stopped on, where it stopped on one
    const rowId = await focusedRowId(page)

    // Whether it stopped somewhere in the list all the same
    const isInList = rowId === null && (await isFocusInPanel(list))

    // Recorded, a row by its id and anything else in the list as a stop that should not be there
    if (rowId !== null) stops.push(rowId)
    else if (isInList) stops.push(NON_ROW_STOP)
  }

  // Still inside after more presses than the panel has stops for, so something in it takes Tab without end
  throw new Error(`Tab never left the panel, stopping among the rows at ${stops.join(', ')}`)
}

/**
 * A function reading one filter off the address.
 *
 * @param page - The page.
 * @param key - The filter's parameter.
 *
 * @returns A function reading it, null where the address carries none.
 */
export function urlParam(page: Page, key: string): () => string | null {
  // Read afresh every call, so a poll sees the address move
  return () => filtersInUrl(page).get(key)
}
