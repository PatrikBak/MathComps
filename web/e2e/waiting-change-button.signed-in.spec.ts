import {
  cardOf,
  FIRST,
  GEOMETRY,
  openPool,
  selectionText,
  stubSelection,
  switchElementaryOn,
  untilSelectionReadAgain,
} from './support/problem-selection'
import { expect, test } from './support/test'

/** What the button over the selection's pool says, and what a screen reader hears while it shows. */
const RESORT = selectionText('pool.resort')

test.describe('the button showing a change a list holds back', () => {
  test('shows while a change waits, said to a screen reader too, and neither once the change is shown', async ({
    page,
  }) => {
    // A reviewer whose selection holds a pool of problems
    await stubSelection(page, 'selection')

    // The pool, its order up to date
    await openPool(page)

    // The button, and the line a screen reader hears it through
    const button = page.getByRole('button', { name: RESORT })
    const said = page.getByRole('status').filter({ hasText: RESORT })

    // No button and nothing said while nothing waits
    await expect(button).toHaveCount(0)
    await expect(said).toHaveCount(0)

    // A change waiting: the elementary category switched on for the geometry problem, which stands last, so the
    // board's elementary paper would now run it near the top
    await switchElementaryOn(page, cardOf(page, GEOMETRY), GEOMETRY)

    // The button shown, and said to a screen reader
    await expect(button).toBeVisible()
    await expect(said).toHaveCount(1)

    // The change shown
    await button.click()

    // No button and nothing said again
    await expect(button).toHaveCount(0)
    await expect(said).toHaveCount(0)
  })

  test("hands the focus to the list's first item when it leaves holding it, the change gone without being asked for", async ({
    page,
  }) => {
    // The clock under the test's hand, so the next read comes when the test says
    await page.clock.install()

    // A reviewer whose selection holds a pool of problems
    const answerSelectionWith = await stubSelection(page, 'selection')

    // The pool
    await openPool(page)

    // A change waiting: the elementary category switched on for the geometry problem, which stands last, so the
    // board's elementary paper would now run it near the top
    await switchElementaryOn(page, cardOf(page, GEOMETRY), GEOMETRY)

    // The button
    const button = page.getByRole('button', { name: RESORT })

    // Holding the focus
    await button.focus()

    // A colleague taking the change back, as the backend holds the selection as it began
    answerSelectionWith('selection')

    // The selection, read again once the category's write has stopped holding the read back
    await untilSelectionReadAgain(page)

    // The button gone, nothing waiting
    await expect(button).toHaveCount(0)

    // The focus on the first problem's name, which stands at the list's top
    await expect(cardOf(page, FIRST).getByRole('link', { name: FIRST.title })).toBeFocused()
  })
})
