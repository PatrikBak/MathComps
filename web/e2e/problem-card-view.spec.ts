import { PROBLEM_CARD_ATTRIBUTE } from '@/components/features/problems/constants/problem-list-attributes'

import messages from '../messages/en.json'
import { NARROW_BAR_WINDOW, openArchive, WIDE_BAR_WINDOW } from './support/archive-filters'
import { expect, SETTLE_TIMEOUT_MS, test } from './support/test'

/** The copy the archive's cards and its bar read under, taken from the app's own English messages. */
const problemsCopy = messages.problems

test.describe('problem card views', () => {
  test.use({ viewport: WIDE_BAR_WINDOW })

  test('draws the cards compact, without what can be done to a problem, and keeps that over a reload', async ({
    page,
  }) => {
    // The archive, its first card drawn
    await openArchive(page)

    // The first card, drawn in full
    const firstCard = page.locator(PROBLEM_CARD_ATTRIBUTE.anySelector).first()

    // Its like button, one of what a full card offers
    const likeButton = firstCard.locator(`button[title="${problemsCopy.like}"]`)
    await expect(likeButton).toBeVisible()

    // The reader opens the bar's view menu
    await page.getByRole('button', { name: problemsCopy.cardView.label, exact: true }).click()

    // And asks for compact cards there
    await page.getByRole('menuitemradio', { name: problemsCopy.cardView.compact }).click()

    // The card drops what can be done to it
    await expect(likeButton).toHaveCount(0)

    // The page loaded again
    await page.reload()

    // The first card back after the reload
    await expect(firstCard).toBeVisible({ timeout: SETTLE_TIMEOUT_MS })

    // The view menu, opened again
    await page.getByRole('button', { name: problemsCopy.cardView.label, exact: true }).click()

    // Saying the cards are compact
    await expect(
      page.getByRole('menuitemradio', { name: problemsCopy.cardView.compact })
    ).toBeChecked()

    // The menu closed again
    await page.keyboard.press('Escape')

    // And still without the like button
    await expect(likeButton).toHaveCount(0)
  })

  test('moves what the bar has no room for into its overflow menu, compact cards included', async ({
    page,
  }) => {
    // A window with room for nothing on the bar beside the filters and the reset
    await page.setViewportSize(NARROW_BAR_WINDOW)
    await openArchive(page)

    // The first card's like button, there while the card is drawn in full
    const likeButton = page
      .locator(PROBLEM_CARD_ATTRIBUTE.anySelector)
      .first()
      .locator(`button[title="${problemsCopy.like}"]`)
    await expect(likeButton).toBeVisible()

    // No view menu on the bar, which has no room for it
    await expect(
      page.getByRole('button', { name: problemsCopy.cardView.label, exact: true })
    ).toHaveCount(0)

    // The reader opens the overflow menu
    await page.getByRole('button', { name: problemsCopy.moreActions }).click()

    // And asks for compact cards there
    await page.getByRole('menuitemradio', { name: problemsCopy.cardView.compact }).click()

    // The card drops what can be done to it
    await expect(likeButton).toHaveCount(0)
  })
})
