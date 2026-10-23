import type { Locator, Page } from '@playwright/test'

import { facetsCopy } from './support/archive-filters'
import { areaCopy } from './support/competitions'
import { ON_OFFER_COUNT, openPool, selectionCopy, stubSelection } from './support/problem-selection'
import { expect, test } from './support/test'

/** The copy the pool's filters read under. */
const filtersCopy = selectionCopy.filters

/** How many of the pool's problems the board on screen holds. */
const ON_BOARD_COUNT = 2

/** How many of the pool's problems are recommended for the intermediate paper. */
const INTERMEDIATE_COUNT = 6

/** How many are recommended for the advanced paper. */
const ADVANCED_COUNT = 1

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

    // Nothing picked on the way
    await expect(selected).not.toBeChecked()
    await expect(notSelected).not.toBeChecked()
    await expect(page.getByRole('article')).toHaveCount(ON_OFFER_COUNT)
  })
})

test.describe('a multi-choice facet on a pill', () => {
  test('names the one option picked, counts the picks from two, and resets from its panel', async ({
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
    const reset = panel.getByRole('button', { name: facetsCopy.resetFilter })

    // Counting them too
    await expect(reset).toHaveText(`${facetsCopy.reset} (2)`)

    // Reset
    await reset.click()

    // The pool back whole, and nothing left ticked
    await expect(cards).toHaveCount(ON_OFFER_COUNT)
    await expect(panel.getByRole('checkbox', { checked: true })).toHaveCount(0)
  })

  test('narrows to the option a modified click lands on, picked or not', async ({ page }) => {
    // The Category facet, opened
    const panel = await openFacet(page, filtersCopy.category, filtersCopy.category)

    // Its options
    const elementary = optionOf(panel, 'checkbox', areaCopy.categories.elementary)
    const intermediate = optionOf(panel, 'checkbox', areaCopy.categories.intermediate)
    const advanced = optionOf(panel, 'checkbox', areaCopy.categories.advanced)

    // One picked the ordinary way
    await elementary.click()

    // Ticked
    await expect(elementary).toBeChecked()

    // And another
    await advanced.click()

    // Ticked beside it
    await expect(advanced).toBeChecked()

    // Hold the modifier and click the third one's checkbox
    await intermediate.click({ modifiers: ['ControlOrMeta'] })

    // The cards the pool shows
    const cards = page.getByRole('article')

    // The pool narrows to it alone, and so do the checkboxes
    await expect(cards).toHaveCount(INTERMEDIATE_COUNT)
    await expect(panel.getByRole('checkbox', { checked: true })).toHaveCount(1)
    await expect(intermediate).toBeChecked()

    // One more picked the ordinary way
    await advanced.click()

    // Ticked beside it
    await expect(advanced).toBeChecked()

    // Hold the modifier and click the picked one's checkbox, which the click alone would unpick
    await advanced.click({ modifiers: ['ControlOrMeta'] })

    // The pool narrows to it, still ticked
    await expect(cards).toHaveCount(ADVANCED_COUNT)
    await expect(panel.getByRole('checkbox', { checked: true })).toHaveCount(1)
    await expect(advanced).toBeChecked()
  })
})
