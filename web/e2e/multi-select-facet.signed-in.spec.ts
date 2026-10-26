import type { Locator, Page } from '@playwright/test'

import { facetsCopy } from './support/archive-filters'
import { areaCopy } from './support/competitions'
import { focusedRowId, isFocusInPanel, panelResetOf, QUIET_MS } from './support/facets'
import { ON_OFFER_COUNT, openPool, selectionCopy, stubSelection } from './support/problem-selection'
import { expect, test } from './support/test'

/** The copy the pool's filters read under. */
const filtersCopy = selectionCopy.filters

/** How many of the pool's problems the board on screen holds. */
const ON_BOARD_COUNT = 2

/** How many of the pool's problems are recommended for the intermediate paper. */
const INTERMEDIATE_COUNT = 6

/**
 * One of the pool's facets, opened from its pill.
 *
 * @param page - The page.
 * @param pill - What the pill says.
 * @param title - The facet's name, which its panel goes by.
 *
 * @returns The open panel.
 */
async function openFacet(page: Page, pill: string, title: string): Promise<Locator> {
  // Open it
  await page.getByRole('button', { name: pill, exact: true }).click()

  // The panel, named after the facet
  const panel = page.getByRole('dialog', { name: title })

  // Once it is up
  await expect(panel).toBeVisible()

  // And focus has followed, which the panel hands it a frame after it appears, a key pressed sooner going to the pill
  await expect.poll(() => isFocusInPanel(panel)).toBe(true)

  // Which is what the test goes on to work in
  return panel
}

/**
 * One option's control in an open facet, whatever count it carries.
 *
 * @param panel - The open panel.
 * @param role - Whether the facet holds one option or several.
 * @param name - The option's name.
 *
 * @returns The radio or checkbox.
 */
function optionOf(panel: Locator, role: 'radio' | 'checkbox', name: string): Locator {
  // Named with its count trailing
  return panel.getByRole(role, { name: new RegExp(`^${name} \\(`) })
}

/**
 * One option's name, away from its control, where a click means what a click on the control does.
 *
 * @param panel - The open panel.
 * @param name - The option's name.
 *
 * @returns The name as it is drawn.
 */
function nameOf(panel: Locator, name: string): Locator {
  // The text alone, which is not the control
  return panel.getByText(name, { exact: true })
}

test.beforeEach(async ({ page }) => {
  // A reviewer whose selection holds a pool of problems, two of them on the board on screen
  await stubSelection(page, 'selection')

  // The pool
  await openPool(page)
})

test.describe('a single-choice facet', () => {
  test('swaps the pick for another, and gives it up when it is clicked again, on its radio or its name', async ({
    page,
  }) => {
    // The State facet, opened
    const panel = await openFacet(page, filtersCopy.state, filtersCopy.state)

    // Its two options
    const selected = optionOf(panel, 'radio', filtersCopy.selected)
    const notSelected = optionOf(panel, 'radio', filtersCopy.notSelected)

    // The cards the pool shows
    const cards = page.getByRole('article')

    // The problems off the board, picked
    await notSelected.click()

    // The pool showing those alone
    await expect(cards).toHaveCount(ON_OFFER_COUNT - ON_BOARD_COUNT)

    // Swapped for those on it
    await selected.click()

    // The pool showing those alone, and the radios agreeing
    await expect(cards).toHaveCount(ON_BOARD_COUNT)
    await expect(selected).toBeChecked()
    await expect(notSelected).not.toBeChecked()

    // The standing option clicked again, on its radio
    await selected.click()

    // Gives the pool back whole, the radio no longer standing
    await expect(cards).toHaveCount(ON_OFFER_COUNT)
    await expect(selected).not.toBeChecked()

    // Picked again, by its name
    await nameOf(panel, filtersCopy.selected).click()

    // Standing again
    await expect(cards).toHaveCount(ON_BOARD_COUNT)
    await expect(selected).toBeChecked()

    // And clicked by its name once more
    await nameOf(panel, filtersCopy.selected).click()

    // Given up again
    await expect(cards).toHaveCount(ON_OFFER_COUNT)
    await expect(selected).not.toBeChecked()
  })

  test('keeps the standing option when a modified click lands on its radio', async ({ page }) => {
    // The State facet, opened
    const panel = await openFacet(page, filtersCopy.state, filtersCopy.state)

    // The option for the problems on the board
    const selected = optionOf(panel, 'radio', filtersCopy.selected)

    // The cards the pool shows
    const cards = page.getByRole('article')

    // Picked
    await selected.click()

    // The pool showing those alone
    await expect(cards).toHaveCount(ON_BOARD_COUNT)

    // Narrowed to with the modifier held, which it already stands alone as
    await selected.click({ modifiers: ['ControlOrMeta'] })

    // Given time for a clear to land, were one coming
    await page.waitForTimeout(QUIET_MS)

    // Still standing, the pool unchanged
    await expect(selected).toBeChecked()
    await expect(cards).toHaveCount(ON_BOARD_COUNT)
  })

  test('walks its options with the arrows without picking any', async ({ page }) => {
    // The State facet, opened, which is too short to draw a search box and so opens on the panel itself
    const panel = await openFacet(page, filtersCopy.state, filtersCopy.state)

    // Its two options
    const selected = optionOf(panel, 'radio', filtersCopy.selected)
    const notSelected = optionOf(panel, 'radio', filtersCopy.notSelected)

    // Down
    await page.keyboard.press('ArrowDown')

    // Into the list at its top
    await expect(selected).toBeFocused()

    // Down again
    await page.keyboard.press('ArrowDown')

    // On to the next option
    await expect(notSelected).toBeFocused()

    // Up
    await page.keyboard.press('ArrowUp')

    // Back on the first
    await expect(selected).toBeFocused()

    // Right, which on a radio would step to its neighbour and pick it
    await page.keyboard.press('ArrowRight')

    // And Left, the same the other way
    await page.keyboard.press('ArrowLeft')

    // Still on the first
    await expect(selected).toBeFocused()

    // Nothing picked on the way
    await expect(selected).not.toBeChecked()
    await expect(notSelected).not.toBeChecked()
    await expect(page.getByRole('article')).toHaveCount(ON_OFFER_COUNT)
  })

  test('takes Tab back in at its pick once focus has left it, wherever the arrows had got to', async ({
    page,
  }) => {
    // The State facet, opened
    const panel = await openFacet(page, filtersCopy.state, filtersCopy.state)

    // Its two options
    const selected = optionOf(panel, 'radio', filtersCopy.selected)
    const notSelected = optionOf(panel, 'radio', filtersCopy.notSelected)

    // The problems on the board, picked
    await selected.click()

    // Standing
    await expect(selected).toBeChecked()

    // Down, onto the top of the list, the click having left focus where it was
    await page.keyboard.press('ArrowDown')

    // On the pick
    await expect(selected).toBeFocused()

    // Down again, off the pick
    await page.keyboard.press('ArrowDown')

    // On the option below it
    await expect(notSelected).toBeFocused()

    // Shift+Tab, out of the list
    await page.keyboard.press('Shift+Tab')

    // Onto the panel's reset
    await expect(panelResetOf(panel)).toBeFocused()

    // Tab, back in
    await page.keyboard.press('Tab')

    // At the pick, the one radio Firefox and Safari let Tab into the group at
    await expect(selected).toBeFocused()
  })
})

test.describe('a multi-choice facet on a pill', () => {
  test('names the one option picked, counts the picks from two, and resets from its panel into its list', async ({
    page,
  }) => {
    // The Category facet, opened
    const panel = await openFacet(page, filtersCopy.category, filtersCopy.category)

    // The cards the pool shows
    const cards = page.getByRole('article')

    // The intermediate paper, picked
    await optionOf(panel, 'checkbox', areaCopy.categories.intermediate).click()

    // The pool narrowed to it
    await expect(cards).toHaveCount(INTERMEDIATE_COUNT)

    // The pill names it in place of the facet
    await expect(
      page.getByRole('button', { name: areaCopy.categories.intermediate, exact: true })
    ).toBeVisible()

    // The advanced paper, picked alongside it
    await optionOf(panel, 'checkbox', areaCopy.categories.advanced).click()

    // The pill, named after the facet again
    const pill = page.getByRole('button', { name: new RegExp(`^${filtersCopy.category}`) })

    // Counting the two
    await expect(pill.getByLabel(facetsCopy.selectedCount.replace('{count}', '2'))).toBeVisible()

    // The panel's reset
    const reset = panelResetOf(panel)

    // Counting them too
    await expect(reset).toHaveText(`${facetsCopy.reset} (2)`)

    // Reset
    await reset.click()

    // The pool back whole, and nothing left ticked
    await expect(cards).toHaveCount(ON_OFFER_COUNT)
    await expect(panel.getByRole('checkbox', { checked: true })).toHaveCount(0)

    // Focus on a row of the list, the facet drawing no search box and the reset gone with nothing to reset
    await expect.poll(() => focusedRowId(page)).not.toBeNull()
  })
})
