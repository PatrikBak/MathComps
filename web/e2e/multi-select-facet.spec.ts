import type { Locator, Page } from '@playwright/test'

import { URL_PARAMS } from '@/components/features/problems/utils/search-url-serialization'
import { FACET_ROW_ATTRIBUTE } from '@/components/shared/components/facets/hooks/use-facet-row-navigation'
import { headingRowId } from '@/components/shared/components/facets/model/facet-logic'

import {
  facetsCopy,
  filtersCopy,
  searchAnswered,
  SHORT_WINDOW,
  TALL_WINDOW,
} from './support/archive-filters'
import { PROBLEMS_PATH, stubProblemSearch } from './support/backend-routes'
import {
  focusedRowId,
  headingResetOf,
  openFacet,
  panelResetOf,
  QUIET_MS,
  rowTabStops,
  triggerOf,
  urlParam,
} from './support/facets'
import { expect, test } from './support/test'

/** The facet listing problem numbers, too short to offer a search box. */
const PROBLEM_NUMBER = filtersCopy.facets.problemNumber

/** The facet listing years, long enough to offer one. */
const SEASON = filtersCopy.facets.season

/** The facet listing keywords, split into sections and offering a choice of logic. */
const TAGS = filtersCopy.facets.tags

/** Every option's checkbox in an open facet, which names the option it stands for. */
const OPTION_CHECKBOX = `input${FACET_ROW_ATTRIBUTE.anySelector}`

/** How long a finger is held down for a long press, with room to spare over what counts as one. */
const LONG_PRESS_MS = 800

/** A phone's screen, narrow enough that the filters move into a panel of their own. */
const PHONE_VIEWPORT = { width: 390, height: 844 }

/**
 * One option's checkbox in an open facet.
 *
 * @param panel - The open panel.
 * @param id - The option's id.
 *
 * @returns The checkbox.
 */
function optionOf(panel: Locator, id: string): Locator {
  // Marked with the option it stands for
  return panel.locator(`input[${FACET_ROW_ATTRIBUTE.name}="${id}"]`)
}

/**
 * One option's row, everywhere along which a click means the same thing.
 *
 * @param panel - The open panel.
 * @param id - The option's id.
 *
 * @returns The row, which a click lands on away from its checkbox.
 */
function rowOf(panel: Locator, id: string): Locator {
  // The label wrapping the option's checkbox
  return optionOf(panel, id).locator('..')
}

/**
 * One section's heading in an open grouped facet.
 *
 * @param panel - The open panel.
 * @param groupKey - The section.
 *
 * @returns The heading, a button rolling the section up and out.
 */
function headingOf(panel: Locator, groupKey: string): Locator {
  // Marked as the row the section's heading is
  return panel.locator(`[${FACET_ROW_ATTRIBUTE.name}="${headingRowId(groupKey)}"]`)
}

/**
 * One section of an open grouped facet.
 *
 * @param panel - The open panel.
 * @param groupKey - The section.
 *
 * @returns The block holding the section's heading and the options under it.
 */
function sectionOf(panel: Locator, groupKey: string): Locator {
  // Two levels up from the heading, past the row it shares with its ordering button
  return headingOf(panel, groupKey).locator('../..')
}

/**
 * The ids of the options a panel or one of its sections shows, top to bottom.
 *
 * @param scope - The open panel, or a section of it.
 *
 * @returns The ids, in the order they are drawn.
 */
async function drawnIds(scope: Locator): Promise<string[]> {
  // Read off every checkbox in document order
  return scope
    .locator(OPTION_CHECKBOX)
    .evaluateAll(
      (checkboxes, attribute) =>
        checkboxes.map((checkbox) => checkbox.getAttribute(attribute) ?? ''),
      FACET_ROW_ATTRIBUTE.name
    )
}

/**
 * The ids of the options an open panel shows ticked, top to bottom.
 *
 * @param panel - The open panel.
 *
 * @returns The ids, in the order they are drawn.
 */
async function checkedIds(panel: Locator): Promise<string[]> {
  // Read off every ticked checkbox in document order
  return panel
    .locator(`${OPTION_CHECKBOX}:checked`)
    .evaluateAll(
      (checkboxes, attribute) =>
        checkboxes.map((checkbox) => checkbox.getAttribute(attribute) ?? ''),
      FACET_ROW_ATTRIBUTE.name
    )
}

/**
 * The names the options a panel or one of its sections shows are read out under, top to bottom.
 *
 * @param scope - The open panel, or a section of it.
 *
 * @returns Each option's name with its count, in the order they are drawn.
 */
async function drawnNames(scope: Locator): Promise<string[]> {
  // Read off every checkbox in document order
  return scope
    .locator(OPTION_CHECKBOX)
    .evaluateAll((checkboxes) =>
      checkboxes.map((checkbox) => checkbox.getAttribute('aria-label') ?? '')
    )
}

/**
 * Picks options one after another the ordinary way, each ticked before the next is clicked.
 *
 * @param panel - The open panel.
 * @param ids - The options' ids, in the order they are picked.
 */
async function pickInTurn(panel: Locator, ids: string[]): Promise<void> {
  // One at a time, since each pick is made against the selection the one before it left
  for (const id of ids) {
    // The option, clicked
    await optionOf(panel, id).click()

    // Ticked before the next one goes
    await expect(optionOf(panel, id)).toBeChecked()
  }
}

/**
 * Holds a finger on an element long enough to count as a long press, then lifts it.
 *
 * @param page - The page.
 * @param target - What the finger lands on.
 */
async function longPress(page: Page, target: Locator): Promise<void> {
  // Scrolled into view, since the finger has to land on it
  await target.scrollIntoViewIfNeeded()

  // Where the element sits
  const box = (await target.boundingBox())!

  // The browser's own touch input, the only way to hold a finger down rather than tap
  const touch = await page.context().newCDPSession(page)

  // A finger put down on its middle
  await touch.send('Input.dispatchTouchEvent', {
    type: 'touchStart',
    touchPoints: [{ x: box.x + box.width / 2, y: box.y + box.height / 2 }],
  })

  // Held there
  await page.waitForTimeout(LONG_PRESS_MS)

  // And lifted
  await touch.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] })
}

test.beforeEach(async ({ page }) => {
  // Every search answered with one and the same page of the archive, which offers every facet its options
  await stubProblemSearch(page, () => null)

  // The archive, with nothing picked yet
  await page.goto(PROBLEMS_PATH)
})

test.describe('picking in a multi-select facet', () => {
  test('picks and unpicks an option from its checkbox and from its name alike', async ({
    page,
  }) => {
    // The facet, opened
    const panel = await openFacet(page, PROBLEM_NUMBER)

    // The first option, picked by its checkbox
    await optionOf(panel, '1').click()

    // The problem numbers picked
    const picked = urlParam(page, URL_PARAMS.PROBLEM_NUMBERS)

    // In the address
    await expect.poll(picked).toBe('1')

    // The second, picked by its name
    await rowOf(panel, '2').click()

    // Alongside the first
    await expect.poll(picked).toBe('1,2')

    // The first, unpicked by its checkbox
    await optionOf(panel, '1').click()

    // Leaving the second
    await expect.poll(picked).toBe('2')

    // The second, unpicked by its name
    await rowOf(panel, '2').click()

    // Leaving nothing
    await expect.poll(picked).toBeNull()

    // Which the checkboxes agree with
    await expect(panel.locator(`${OPTION_CHECKBOX}:checked`)).toHaveCount(0)
  })

  test('narrows to the option a modified click lands on, on its checkbox and on its name alike', async ({
    page,
  }) => {
    // The facet, opened
    const panel = await openFacet(page, PROBLEM_NUMBER)

    // The options it offers, in the order they are drawn
    const [first, second, third, fourth] = await drawnIds(panel)

    // The first two picked the ordinary way
    await pickInTurn(panel, [first, second])

    // The problem numbers picked
    const picked = urlParam(page, URL_PARAMS.PROBLEM_NUMBERS)

    // Standing together
    await expect.poll(picked).toBe(`${first},${second}`)

    // Hold the modifier and click the third option's checkbox itself
    await optionOf(panel, third).click({ modifiers: ['ControlOrMeta'] })

    // The facet narrows to it, rather than adding it to the two
    await expect.poll(picked).toBe(third)

    // And the checkboxes say the same, the narrowed option standing alone
    await expect(panel.locator(`${OPTION_CHECKBOX}:checked`)).toHaveCount(1)
    await expect(optionOf(panel, third)).toBeChecked()

    // Hold the modifier and click the fourth option's row, away from its checkbox
    await rowOf(panel, fourth).click({ modifiers: ['ControlOrMeta'] })

    // The facet narrows to that one instead
    await expect.poll(picked).toBe(fourth)

    // Which the checkboxes agree with
    await expect(panel.locator(`${OPTION_CHECKBOX}:checked`)).toHaveCount(1)
    await expect(optionOf(panel, fourth)).toBeChecked()
  })

  test('narrows to an option already picked when a modified click lands on its checkbox', async ({
    page,
  }) => {
    // The facet, opened
    const panel = await openFacet(page, PROBLEM_NUMBER)

    // Three options picked the ordinary way
    await pickInTurn(panel, ['1', '2', '3'])

    // The problem numbers picked
    const picked = urlParam(page, URL_PARAMS.PROBLEM_NUMBERS)

    // Standing together
    await expect.poll(picked).toBe('1,2,3')

    // Hold the modifier and click the middle one's checkbox, which the click alone would unpick
    await optionOf(panel, '2').click({ modifiers: ['ControlOrMeta'] })

    // The facet narrows to it, keeping it
    await expect.poll(picked).toBe('2')

    // And its checkbox stays ticked, the only one that does
    await expect(optionOf(panel, '2')).toBeChecked()
    await expect(panel.locator(`${OPTION_CHECKBOX}:checked`)).toHaveCount(1)
  })

  test('narrows to the focused option when the modifier is held with Space', async ({ page }) => {
    // The facet, opened
    const panel = await openFacet(page, PROBLEM_NUMBER)

    // Two options picked the ordinary way
    await pickInTurn(panel, ['1', '2'])

    // The problem numbers picked
    const picked = urlParam(page, URL_PARAMS.PROBLEM_NUMBERS)

    // Standing together
    await expect.poll(picked).toBe('1,2')

    // Focus on the third
    await optionOf(panel, '3').focus()

    // Space, with the modifier held
    await page.keyboard.press('ControlOrMeta+Space')

    // The facet narrows to the focused option, the way a modified click on it does
    await expect.poll(picked).toBe('3')

    // Which the checkboxes agree with
    await expect(panel.locator(`${OPTION_CHECKBOX}:checked`)).toHaveCount(1)
    await expect(optionOf(panel, '3')).toBeChecked()
  })

  test('opens again with the picked options at the top', async ({ page }) => {
    // The facet, opened
    let panel = await openFacet(page, PROBLEM_NUMBER)

    // The options in the order they come in
    const incoming = await drawnIds(panel)

    // The last of them, picked
    await optionOf(panel, incoming.at(-1)!).click()

    // The problem numbers picked
    const picked = urlParam(page, URL_PARAMS.PROBLEM_NUMBERS)

    // In the address
    await expect.poll(picked).toBe(incoming.at(-1))

    // The facet, closed
    await page.keyboard.press('Escape')

    // And opened again
    panel = await openFacet(page, PROBLEM_NUMBER)

    // The picked option at the top, the rest holding their order beneath it
    expect(await drawnIds(panel)).toEqual([incoming.at(-1), ...incoming.slice(0, -1)])
  })

  test('holds every row in place while options are picked, so quick clicks land where they were aimed', async ({
    page,
  }) => {
    // The facet, opened
    const panel = await openFacet(page, PROBLEM_NUMBER)

    // The options in the order they are drawn
    const incoming = await drawnIds(panel)

    // The bottom three, aimed at from the bottom up, since a pick floating up would push the rows above it down
    const aimed = incoming.slice(-3).reverse()

    // Where each of them sits as the panel opens
    const centres = await Promise.all(
      aimed.map(async (id) => {
        // The checkbox's box
        const box = (await optionOf(panel, id).boundingBox())!

        // Its middle
        return { x: box.x + box.width / 2, y: box.y + box.height / 2 }
      })
    )

    // The answer to the search naming all three, which is what would move a row if anything did
    const answered = searchAnswered(
      page,
      (parameters) => parameters.problemNumbers.length === aimed.length
    )

    // Clicked back to back, the way a reader running down the list does
    for (const centre of centres) await page.mouse.click(centre.x, centre.y)

    // Exactly the options aimed at end up picked
    await expect.poll(async () => (await checkedIds(panel)).sort()).toEqual([...aimed].sort())

    // Answered
    await answered

    // And given time to be drawn
    await page.waitForTimeout(QUIET_MS)

    // And not one row moved
    expect(await drawnIds(panel)).toEqual(incoming)
  })

  test('resets the facet from its heading, handing focus to its trigger', async ({ page }) => {
    // The facet, opened
    const panel = await openFacet(page, PROBLEM_NUMBER)

    // Two options picked
    await pickInTurn(panel, ['1', '2'])

    // The problem numbers picked
    const picked = urlParam(page, URL_PARAMS.PROBLEM_NUMBERS)

    // Standing together
    await expect.poll(picked).toBe('1,2')

    // The facet, closed again
    await page.keyboard.press('Escape')

    // The trigger counting them
    await expect(
      triggerOf(page, PROBLEM_NUMBER).getByLabel(facetsCopy.selectedCount.replace('{count}', '2'))
    ).toBeVisible()

    // The reset beside the facet's name
    const reset = headingResetOf(page, PROBLEM_NUMBER)

    // Pressed
    await reset.click()

    // Nothing left picked
    await expect.poll(picked).toBeNull()

    // And nothing left to reset
    await expect(reset).toBeHidden()

    // Focus handed on to the trigger as the reset fades, where the next Tab goes on from
    await expect(triggerOf(page, PROBLEM_NUMBER)).toBeFocused()
  })
})

test.describe('a multi-select facet from the keyboard', () => {
  test('walks the options with the arrows and picks the focused one with Space', async ({
    page,
  }) => {
    // The facet, opened, which is too short to draw a search box and so opens on the panel itself
    const panel = await openFacet(page, PROBLEM_NUMBER)

    // The options in the order they are drawn
    const ids = await drawnIds(panel)

    // Down
    await page.keyboard.press('ArrowDown')

    // Into the list at its top
    await expect.poll(() => focusedRowId(page)).toBe(ids[0])

    // Down again
    await page.keyboard.press('ArrowDown')

    // On to the next option
    await expect.poll(() => focusedRowId(page)).toBe(ids[1])

    // End
    await page.keyboard.press('End')

    // At the bottom
    await expect.poll(() => focusedRowId(page)).toBe(ids.at(-1))

    // Down from there
    await page.keyboard.press('ArrowDown')

    // Staying put
    await expect.poll(() => focusedRowId(page)).toBe(ids.at(-1))

    // Home
    await page.keyboard.press('Home')

    // Back at the top
    await expect.poll(() => focusedRowId(page)).toBe(ids[0])

    // Up from there
    await page.keyboard.press('ArrowUp')

    // Staying put
    await expect.poll(() => focusedRowId(page)).toBe(ids[0])

    // Space picks the option focus is on
    await page.keyboard.press('Space')

    // The problem numbers picked
    const picked = urlParam(page, URL_PARAMS.PROBLEM_NUMBERS)

    // That option alone
    await expect.poll(picked).toBe(ids[0])
  })

  test('hands focus to the option a click lands on while focus sits on another, so the keys go on from it', async ({
    page,
  }) => {
    // The facet, opened on the panel itself
    const panel = await openFacet(page, PROBLEM_NUMBER)

    // The options in the order they are drawn
    const ids = await drawnIds(panel)

    // Down, into the list at its top
    await page.keyboard.press('ArrowDown')

    // On the top option
    await expect.poll(() => focusedRowId(page)).toBe(ids[0])

    // The third option, clicked by its name
    await rowOf(panel, ids[2]).click()

    // The problem numbers picked
    const picked = urlParam(page, URL_PARAMS.PROBLEM_NUMBERS)

    // That option
    await expect.poll(picked).toBe(ids[2])

    // With focus come along to it
    await expect.poll(() => focusedRowId(page)).toBe(ids[2])

    // Space
    await page.keyboard.press('Space')

    // Unpicks the option clicked, rather than the one the arrows had reached
    await expect.poll(picked).toBeNull()
  })

  test('stands in the tab order as one stop, on the option picked', async ({ page }) => {
    // The facet, opened
    let panel = await openFacet(page, TAGS)

    // A goal picked, which leads its own section but stands below the area section at the top of the list
    await optionOf(panel, 'prove-existence').click()

    // In the address
    await expect.poll(urlParam(page, URL_PARAMS.TAGS)).toBe('prove-existence')

    // The facet, closed
    await page.keyboard.press('Escape')

    // And opened again
    panel = await openFacet(page, TAGS)

    // Tab through the panel, noting each stop among the rows
    const stops = await rowTabStops(page, panel)

    // One stop among the rows, and that on the option picked rather than the heading at the top of the list
    expect(stops).toEqual(['prove-existence'])
  })

  test('keeps its one stop on the row the arrows reached, so Tab and Shift+Tab leave from there', async ({
    page,
  }) => {
    // The facet, opened with nothing picked, the heading at the top of the list holding the stop
    let panel = await openFacet(page, TAGS)

    // Down twice, past the heading to the first option under it
    await page.keyboard.press('ArrowDown')
    await page.keyboard.press('ArrowDown')

    // On that option
    await expect.poll(() => focusedRowId(page)).toBe((await drawnIds(sectionOf(panel, 'area')))[0])

    // Shift+Tab
    await page.keyboard.press('Shift+Tab')

    // Off the rows altogether, past the heading at the top of the list onto the logic above it
    await expect(
      panel.getByRole('radio', { name: filtersCopy.facets.logic.or, exact: true })
    ).toBeFocused()

    // A goal picked, which leads its own section below the area section
    await optionOf(panel, 'prove-existence').click()

    // In the address
    await expect.poll(urlParam(page, URL_PARAMS.TAGS)).toBe('prove-existence')

    // The facet, closed
    await page.keyboard.press('Escape')

    // And opened again, on its search box
    panel = await openFacet(page, TAGS)

    // Down, onto the heading at the top of the list
    await page.keyboard.press('ArrowDown')

    // On the area heading
    await expect(headingOf(panel, 'area')).toBeFocused()

    // Tab leaves the panel from there, passing the picked goal by
    expect(await rowTabStops(page, panel)).toEqual([])
  })

  test('hands the stop to the rolled-up section a pick sits hidden in', async ({ page }) => {
    // The facet, opened
    let panel = await openFacet(page, TAGS)

    // A goal picked
    await optionOf(panel, 'prove-existence').click()

    // In the address
    await expect.poll(urlParam(page, URL_PARAMS.TAGS)).toBe('prove-existence')

    // Its section, rolled up over it
    await headingOf(panel, 'goal').click()

    // Rolled up
    await expect(headingOf(panel, 'goal')).toHaveAttribute('aria-expanded', 'false')

    // The facet, closed
    await page.keyboard.press('Escape')

    // And opened again
    panel = await openFacet(page, TAGS)

    // Tab through the panel, noting each stop among the rows
    const stops = await rowTabStops(page, panel)

    // One stop among the rows, on the heading of the section holding the pick
    expect(stops).toEqual([headingRowId('goal')])
  })

  test('hands focus to a heading whose click rolls away the option focus was on', async ({
    page,
  }) => {
    // The facet, opened
    const panel = await openFacet(page, TAGS)

    // A goal picked, which takes the tab stop once no row holds focus
    await optionOf(panel, 'prove-existence').click()

    // In the address
    await expect.poll(urlParam(page, URL_PARAMS.TAGS)).toBe('prove-existence')

    // Down twice, past the heading to the first option under it
    await page.keyboard.press('ArrowDown')
    await page.keyboard.press('ArrowDown')

    // On that option
    await expect.poll(() => focusedRowId(page)).toBe((await drawnIds(sectionOf(panel, 'area')))[0])

    // Its section's heading, clicked
    await headingOf(panel, 'area').click()

    // Rolled up, focus on the heading that rolled it
    await expect(headingOf(panel, 'area')).toHaveAttribute('aria-expanded', 'false')
    await expect(headingOf(panel, 'area')).toBeFocused()
  })

  test('closes on Escape, handing focus back to the button that opened it', async ({ page }) => {
    // The facet, opened
    const panel = await openFacet(page, PROBLEM_NUMBER)

    // Escape
    await page.keyboard.press('Escape')

    // The panel goes
    await expect(panel).toBeHidden()

    // And focus is back where the reader started
    await expect(triggerOf(page, PROBLEM_NUMBER)).toBeFocused()
  })
})

test.describe('searching a multi-select facet', () => {
  test('narrows the options to the search, and says so when nothing matches, the caret staying in the box', async ({
    page,
  }) => {
    // The facet, opened
    const panel = await openFacet(page, SEASON)

    // The search box
    const search = panel.getByRole('textbox')

    // Which the panel opens on
    await expect(search).toBeFocused()

    // A year only one option carries
    await page.keyboard.type('2017/2018')

    // That option alone
    await expect(panel.locator(OPTION_CHECKBOX)).toHaveCount(1)

    // A search matching nothing
    await search.fill('no such year')

    // The words saying nothing matches
    const noResults = panel.getByText(facetsCopy.noResults, { exact: true })

    // Shown, with no option left
    await expect(noResults).toBeVisible()
    await expect(panel.locator(OPTION_CHECKBOX)).toHaveCount(0)

    // The words, pressed
    await noResults.click()

    // The search typed straight on
    await page.keyboard.type('s')

    // Into the box it was in
    await expect(search).toHaveValue('no such years')
  })

  test('keeps the caret in the box through a click on each control, and a new term reopens every section', async ({
    page,
  }) => {
    // The facet, opened
    const panel = await openFacet(page, TAGS)

    // Half a search typed
    await page.keyboard.type('geo')

    // A keyword it finds, picked by the edge of its row, clear of its name
    await rowOf(panel, 'geometry')
      .locator('..')
      .click({ position: { x: 4, y: 4 } })

    // In the address
    await expect.poll(urlParam(page, URL_PARAMS.TAGS)).toBe('geometry')

    // The heading of the section holding it
    const area = headingOf(panel, 'area')

    // Its ordering button
    const sort = area.locator('xpath=following-sibling::button')

    // Pressed
    await sort.click()

    // Now by count with the largest first
    await expect(sort).toHaveAccessibleName(facetsCopy.sortByCountDesc)

    // The heading's strip, pressed clear of its name
    await area.locator('..').click({ position: { x: 4, y: 4 } })

    // The section, rolled up by its heading
    await area.click()

    // Rolled up
    await expect(area).toHaveAttribute('aria-expanded', 'false')

    // The choice of matching every keyword picked
    const matchAll = panel.getByRole('radio', { name: filtersCopy.facets.logic.and, exact: true })

    // Asked for rather than any
    await matchAll.click()

    // Standing, though the address only carries it once two keywords are picked
    await expect(matchAll).toBeChecked()

    // The rest of the search typed straight on
    await page.keyboard.type('metry')

    // Into the box it started in
    await expect(panel.getByRole('textbox')).toHaveValue('geometry')

    // The section unrolled again, a new term opening every section afresh
    await expect(area).toHaveAttribute('aria-expanded', 'true')
  })

  test('empties the search on the first Escape and closes on the second', async ({ page }) => {
    // The facet, opened
    const panel = await openFacet(page, SEASON)

    // Every option it offers
    const offered = await panel.locator(OPTION_CHECKBOX).count()

    // A year only one option carries, searched
    await page.keyboard.type('2017/2018')

    // Leaving that option alone
    await expect(panel.locator(OPTION_CHECKBOX)).toHaveCount(1)

    // Escape
    await page.keyboard.press('Escape')

    // The search is gone and the panel still up, offering everything again
    await expect(panel.locator(OPTION_CHECKBOX)).toHaveCount(offered)

    // Escape again
    await page.keyboard.press('Escape')

    // The panel goes
    await expect(panel).toBeHidden()
  })

  test('opens again on the whole list, whatever was searched before it closed', async ({
    page,
  }) => {
    // The facet, opened
    let panel = await openFacet(page, SEASON)

    // Every option it offers
    const offered = await panel.locator(OPTION_CHECKBOX).count()

    // A year only one option carries, searched
    await page.keyboard.type('2017/2018')

    // Leaving that option alone
    await expect(panel.locator(OPTION_CHECKBOX)).toHaveCount(1)

    // A press somewhere else on the page
    await page.mouse.click(5, 5)

    // Closes it
    await expect(panel).toBeHidden()

    // Opened again
    panel = await openFacet(page, SEASON)

    // On an empty search box and every option
    await expect(panel.getByRole('textbox')).toHaveValue('')
    await expect(panel.locator(OPTION_CHECKBOX)).toHaveCount(offered)
  })

  test('holds a pick made during a search in place until the panel opens again', async ({
    page,
  }) => {
    // The facet, opened
    let panel = await openFacet(page, SEASON)

    // The options in the order they are drawn, nothing picked yet
    const incoming = await drawnIds(panel)

    // A search several options match
    await page.keyboard.type('Edition 6')

    // Those options, in the order they are drawn
    const matches = await drawnIds(panel)

    // The search finds enough of them for one to sit below another
    expect(matches.length).toBeGreaterThan(2)

    // The third of them, picked
    await optionOf(panel, matches[2]).click()

    // The years picked
    const picked = urlParam(page, URL_PARAMS.SEASONS)

    // In the address
    await expect.poll(picked).toBe(matches[2])

    // The search, emptied
    await panel
      .getByRole('button', { name: facetsCopy.clearSearch.replace('{name}', SEASON.toLowerCase()) })
      .click()

    // The whole list back
    await expect(panel.locator(OPTION_CHECKBOX)).toHaveCount(incoming.length)

    // In the order it opened in, the pick where it always stood
    expect(await drawnIds(panel)).toEqual(incoming)

    // The facet, closed
    await page.keyboard.press('Escape')

    // And opened again
    panel = await openFacet(page, SEASON)

    // The picked option now leads the list
    expect((await drawnIds(panel))[0]).toBe(matches[2])
  })
})

test.describe('a multi-select facet split into sections', () => {
  test('rolls a section up and back out from its heading, by click and by the arrows', async ({
    page,
  }) => {
    // The facet, opened
    const panel = await openFacet(page, TAGS)

    // The area section's heading
    const area = headingOf(panel, 'area')

    // One of the area section's options
    const geometry = optionOf(panel, 'geometry')

    // Open to begin with
    await expect(area).toHaveAttribute('aria-expanded', 'true')
    await expect(geometry).toBeVisible()

    // The heading, clicked
    await area.click()

    // Rolls the section up
    await expect(area).toHaveAttribute('aria-expanded', 'false')
    await expect(geometry).toHaveCount(0)

    // Down from the search box the click left the caret in, onto the heading at the top of the list
    await page.keyboard.press('ArrowDown')

    // On the heading
    await expect(area).toBeFocused()

    // Right
    await page.keyboard.press('ArrowRight')

    // Unrolls it again
    await expect(area).toHaveAttribute('aria-expanded', 'true')
    await expect(geometry).toBeVisible()

    // Left
    await page.keyboard.press('ArrowLeft')

    // Rolls it back up
    await expect(area).toHaveAttribute('aria-expanded', 'false')
    await expect(geometry).toHaveCount(0)
  })

  test('counts the options picked under each heading', async ({ page }) => {
    // The facet, opened
    const panel = await openFacet(page, TAGS)

    // Two of the area section's options, picked
    await pickInTurn(panel, ['geometry', 'combinatorics'])

    // The area heading counting them
    await expect(
      headingOf(panel, 'area').getByLabel(facetsCopy.selectedInGroup.replace('{count}', '2'))
    ).toBeVisible()

    // And the goal heading counting none
    await expect(headingOf(panel, 'goal').getByText(/\d/)).toHaveCount(0)
  })

  test('cycles a section through its orderings, from its button and from the s key', async ({
    page,
  }) => {
    // The facet, opened
    const panel = await openFacet(page, TAGS)

    // The area section's heading, whose only option counting a problem is combinatorics
    const area = headingOf(panel, 'area')

    // The section itself
    const section = sectionOf(panel, 'area')

    // Its ordering button beside it, which names the ordering the section is under
    const sort = area.locator('xpath=following-sibling::button')

    // By name to begin with
    await expect(sort).toHaveAccessibleName(facetsCopy.sortAlphabetically)

    // The names the section shows
    const byName = await drawnNames(section)

    // In alphabetical order
    expect(byName).toEqual([...byName].sort((first, second) => first.localeCompare(second, 'en')))

    // The ordering button, pressed
    await sort.click()

    // Now by count with the largest first
    await expect(sort).toHaveAccessibleName(facetsCopy.sortByCountDesc)

    // Which puts combinatorics on top
    expect((await drawnIds(section))[0]).toBe('combinatorics')

    // The heading, focused
    await area.focus()

    // Its own key for the next ordering
    await page.keyboard.press('s')

    // Now by count with the smallest first
    await expect(sort).toHaveAccessibleName(facetsCopy.sortByCountAsc)

    // Which puts combinatorics at the bottom
    expect((await drawnIds(section)).at(-1)).toBe('combinatorics')
  })

  test('orders what a search finds the way its section is ordered, the button reordering it there and then', async ({
    page,
  }) => {
    // The facet, opened
    const panel = await openFacet(page, TAGS)

    // A search finding combinatorics beside another area keyword
    await page.keyboard.type('com')

    // The area section
    const section = sectionOf(panel, 'area')

    // The names it shows
    const byName = await drawnNames(section)

    // More than one of them, in alphabetical order as the section starts
    expect(byName.length).toBeGreaterThan(1)
    expect(byName).toEqual([...byName].sort((first, second) => first.localeCompare(second, 'en')))

    // The section's ordering button, pressed
    await headingOf(panel, 'area').locator('xpath=following-sibling::button').click()

    // Combinatorics, the only one counting a problem, now on top
    await expect.poll(async () => (await drawnIds(section))[0]).toBe('combinatorics')
  })

  test('opens a rolled-up section for the length of a search that finds something in it', async ({
    page,
  }) => {
    // The facet, opened
    const panel = await openFacet(page, TAGS)

    // The goal section's heading
    const goal = headingOf(panel, 'goal')

    // The heading, clicked
    await goal.click()

    // Rolls its section up
    await expect(goal).toHaveAttribute('aria-expanded', 'false')

    // A search that finds goals
    await panel.getByRole('textbox').fill('prove')

    // The section opens to show them
    await expect(goal).toHaveAttribute('aria-expanded', 'true')
    await expect(optionOf(panel, 'prove-existence')).toBeVisible()

    // The search, emptied
    await panel.getByRole('textbox').fill('')

    // The section goes back to how the reader left it
    await expect(goal).toHaveAttribute('aria-expanded', 'false')

    // While the one they never touched stays open
    await expect(headingOf(panel, 'area')).toHaveAttribute('aria-expanded', 'true')
  })

  test('keeps a section the reader rolled up under a search shut while a pick lands in another', async ({
    page,
  }) => {
    // The facet, opened
    const panel = await openFacet(page, TAGS)

    // A search finding keywords in two sections
    await panel.getByRole('textbox').fill('num')

    // The type section's heading
    const type = headingOf(panel, 'type')

    // Open, to show what the search found in it
    await expect(type).toHaveAttribute('aria-expanded', 'true')

    // Rolled up by its heading
    await type.click()

    // Rolled up
    await expect(type).toHaveAttribute('aria-expanded', 'false')

    // The answer to the search the pick sends, which is what would roll the section back out if anything did
    const answered = searchAnswered(page, (parameters) =>
      parameters.tagSlugs.includes('number-theory')
    )

    // A keyword the search found in the area section, picked
    await optionOf(panel, 'number-theory').click()

    // In the address
    await expect.poll(urlParam(page, URL_PARAMS.TAGS)).toBe('number-theory')

    // Answered
    await answered

    // And given time to be drawn
    await page.waitForTimeout(QUIET_MS)

    // The type section still rolled up
    await expect(type).toHaveAttribute('aria-expanded', 'false')
  })

  test('switches between matching any of the picks and all of them', async ({ page }) => {
    // The facet, opened
    const panel = await openFacet(page, TAGS)

    // Two keywords picked
    await pickInTurn(panel, ['geometry', 'combinatorics'])

    // The choice of matching any of them
    const matchAny = panel.getByRole('radio', { name: filtersCopy.facets.logic.or, exact: true })

    // Which they are matched under to begin with
    await expect(matchAny).toBeChecked()

    // All of them asked for
    await panel.getByRole('radio', { name: filtersCopy.facets.logic.and, exact: true }).click()

    // The logic the keywords are matched under
    const logic = urlParam(page, URL_PARAMS.TAG_LOGIC)

    // In the address
    await expect.poll(logic).toBe('and')

    // Back to any
    await matchAny.click()

    // Gone from the address, any being the default
    await expect.poll(logic).toBeNull()

    // Tab, from the search box the clicks left the caret in
    await page.keyboard.press('Tab')

    // Onto the mode standing
    await expect(matchAny).toBeFocused()

    // The next mode, from the keyboard
    await page.keyboard.press('ArrowRight')

    // All of them asked for again
    await expect.poll(logic).toBe('and')

    // Focus on that mode, where the arrow moved it
    await expect(
      panel.getByRole('radio', { name: filtersCopy.facets.logic.and, exact: true })
    ).toBeFocused()
  })
})

test.describe('the header of a multi-select facet', () => {
  test('moves into the panel while the panel opens over the heading, and stays beside the heading otherwise', async ({
    page,
  }) => {
    // A window short enough for the panel to open above its trigger
    await page.setViewportSize(SHORT_WINDOW)

    // The facet, opened
    let panel = await openFacet(page, PROBLEM_NUMBER)

    // An option picked, which gives the reset something to do
    await optionOf(panel, '1').click()

    // In the address
    await expect.poll(urlParam(page, URL_PARAMS.PROBLEM_NUMBERS)).toBe('1')

    // The panel carries the reset, the heading's being covered
    await expect(panelResetOf(panel)).toBeVisible()
    await expect(headingResetOf(page, PROBLEM_NUMBER)).toBeHidden()

    // The facet, closed
    await page.keyboard.press('Escape')

    // A window tall enough for the panel to open below its trigger
    await page.setViewportSize(TALL_WINDOW)

    // The facet, opened again
    panel = await openFacet(page, PROBLEM_NUMBER)

    // The reset stays beside the heading, and the panel carries none
    await expect(headingResetOf(page, PROBLEM_NUMBER)).toBeVisible()
    await expect(panelResetOf(panel)).toHaveCount(0)
  })
})

test.describe('a multi-select facet on a touchscreen', () => {
  test.use({ hasTouch: true })

  test('narrows to the option a long press lands on, on its name and on its checkbox alike', async ({
    page,
  }) => {
    // The facet, opened
    const panel = await openFacet(page, PROBLEM_NUMBER)

    // Two options picked the ordinary way
    await pickInTurn(panel, ['1', '2'])

    // A long press on the third option's name
    await longPress(page, rowOf(panel, '3'))

    // The problem numbers picked
    const picked = urlParam(page, URL_PARAMS.PROBLEM_NUMBERS)

    // The facet narrowed to it
    await expect.poll(picked).toBe('3')

    // Given time for anything the release sends to land
    await page.waitForTimeout(QUIET_MS)

    // And nothing after the press undid that
    expect(picked()).toBe('3')
    expect(await checkedIds(panel)).toEqual(['3'])

    // A long press on the fourth option's checkbox itself
    await longPress(page, optionOf(panel, '4'))

    // The facet narrowed to that one instead
    await expect.poll(picked).toBe('4')

    // Given time for anything the release sends to land
    await page.waitForTimeout(QUIET_MS)

    // And nothing undid it
    expect(picked()).toBe('4')
    expect(await checkedIds(panel)).toEqual(['4'])

    // A tap on the first option
    await optionOf(panel, '1').tap()

    // An ordinary pick again, joining the fourth
    await expect.poll(picked).toBe('4,1')
  })
})

test.describe('a multi-select facet in the filters panel of a phone', () => {
  test.use({ viewport: PHONE_VIEWPORT })

  test('picks options without closing the filters around it', async ({ page }) => {
    // The filters, opened
    await page.getByRole('button', { name: facetsCopy.open, exact: true }).click()

    // The facet, opened inside it
    const panel = await openFacet(page, PROBLEM_NUMBER)

    // Two options picked
    await pickInTurn(panel, ['1', '2'])

    // The problem numbers picked
    const picked = urlParam(page, URL_PARAMS.PROBLEM_NUMBERS)

    // Standing together
    await expect.poll(picked).toBe('1,2')

    // Given time for a panel closing on the picks to finish going
    await page.waitForTimeout(QUIET_MS)

    // The facet still open, inside a filters panel still open
    expect(await panel.isVisible()).toBe(true)
    expect(await page.getByRole('button', { name: facetsCopy.close }).isVisible()).toBe(true)
  })
})
