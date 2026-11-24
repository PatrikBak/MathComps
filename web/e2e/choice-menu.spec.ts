import messages from '../messages/en.json'
import { NARROW_BAR_WINDOW, openArchive, WIDE_BAR_WINDOW } from './support/archive-filters'
import { expect, test } from './support/test'

/** The copy the archive's bar and its menus read under, taken from the app's own English messages. */
const problemsCopy = messages.problems

test.describe('choice menu', () => {
  test('names its options by the choice they belong to, the one picked checked', async ({
    page,
  }) => {
    // Room on the bar for the choice's own menu
    await page.setViewportSize(WIDE_BAR_WINDOW)
    await openArchive(page)

    // The choice of how the cards are drawn, opened from its trigger
    await page.getByRole('button', { name: problemsCopy.cardView.label, exact: true }).click()

    // Its options stand in a group named for the choice
    const options = page.getByRole('group', { name: problemsCopy.cardView.label })
    await expect(options).toBeVisible()

    // The full cards are the ones picked, and only they
    await expect(
      options.getByRole('menuitemradio', { name: problemsCopy.cardView.full })
    ).toBeChecked()
    await expect(
      options.getByRole('menuitemradio', { name: problemsCopy.cardView.compact })
    ).not.toBeChecked()
  })

  test('names its options the same inside another menu', async ({ page }) => {
    // No room on the bar, so the choice sits in the overflow menu
    await page.setViewportSize(NARROW_BAR_WINDOW)
    await openArchive(page)

    // The overflow menu, opened
    await page.getByRole('button', { name: problemsCopy.moreActions }).click()

    // The choice's options, a group of its own named for it
    const options = page.getByRole('group', { name: problemsCopy.cardView.label })

    // The full cards checked there as well
    await expect(
      options.getByRole('menuitemradio', { name: problemsCopy.cardView.full })
    ).toBeChecked()
  })
})
