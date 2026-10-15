import type { Locator, Page } from '@playwright/test'

import type {
  Proposal,
  RatingScore,
} from '@/components/features/problem-selection/model/selection-types'

import { READER_NAME } from './support/comments'
import {
  actionsButton,
  ALGEBRA,
  cardOf,
  FIRST,
  isProposalWrite,
  openPool,
  OTHER_RATER,
  recordWrites,
  SELECTION_ENDPOINT,
  selectionCopy,
  selectionText,
  stubSelection,
} from './support/problem-selection'
import { expect, test } from './support/test'

/** The rating copy. */
const ratingsCopy = selectionCopy.ratings

/**
 * One score in a problem's menu, under the aspect it scores.
 *
 * @param page - The page, with the menu open.
 * @param aspect - What the aspect is called.
 * @param score - The score.
 *
 * @returns The score's item.
 */
function scoreItem(page: Page, aspect: string, score: RatingScore): Locator {
  // The score's item in the aspect's row
  return page
    .getByRole('group', { name: aspect })
    .getByRole('menuitemradio', { name: String(score), exact: true })
}

/**
 * The mark on a problem's card counting the reviewers who rated it.
 *
 * @param page - The page.
 * @param proposal - The problem.
 * @param count - How many reviewers the mark says rated it.
 *
 * @returns The mark.
 */
function ratingsMark(page: Page, proposal: Proposal, count: number): Locator {
  // The card's button saying how many rated the problem
  return cardOf(page, proposal).getByRole('button', {
    name: selectionText('ratings.ratedBy', { count }),
  })
}

test.describe('rating a problem', () => {
  test("gives scores from a card's menu, which stays open, and shows the card's count of raters", async ({
    page,
  }) => {
    // A reviewer whose pool's first problem nobody has rated
    await stubSelection(page, 'selection')

    // Every write the page sends to a problem
    const writes = recordWrites(page, isProposalWrite)

    // The pool
    await openPool(page)

    // No count on the card while nobody has rated it
    await expect(ratingsMark(page, FIRST, 0)).toHaveCount(0)

    // The menu on the problem's card
    await actionsButton(cardOf(page, FIRST), FIRST).click()

    // A beauty of 4
    await scoreItem(page, ratingsCopy.beauty, 4).click()

    // A difficulty of 2 straight after, the first write possibly still out
    await scoreItem(page, ratingsCopy.difficulty, 2).click()

    // Both chosen, the menu still open
    await expect(scoreItem(page, ratingsCopy.beauty, 4)).toBeChecked()
    await expect(scoreItem(page, ratingsCopy.difficulty, 2)).toBeChecked()

    // Each write stating the whole rating as it then stood, the second keeping the first's beauty
    await expect
      .poll(() => writes().map((write) => [write.method(), write.url(), write.postDataJSON()]))
      .toEqual([
        [
          'PUT',
          `${SELECTION_ENDPOINT}/proposals/${FIRST.id}/rating`,
          { beauty: 4, difficulty: null },
        ],
        ['PUT', `${SELECTION_ENDPOINT}/proposals/${FIRST.id}/rating`, { beauty: 4, difficulty: 2 }],
      ])

    // The menu, closed from the keyboard
    await page.keyboard.press('Escape')

    // The card counting one reviewer, the reader
    await expect(ratingsMark(page, FIRST, 1)).toBeVisible()
  })

  test('takes a score back when the one given is pressed again, and the rating with its last score', async ({
    page,
  }) => {
    // A reviewer who gave the algebra problem a beauty of 5 and a difficulty of 2, beside another reviewer's rating
    await stubSelection(page, 'selection')

    // Every write the page sends to a problem
    const writes = recordWrites(page, isProposalWrite)

    // The pool
    await openPool(page)

    // The menu on the problem's card
    await actionsButton(cardOf(page, ALGEBRA), ALGEBRA).click()

    // The reader's scores chosen
    await expect(scoreItem(page, ratingsCopy.beauty, 5)).toBeChecked()
    await expect(scoreItem(page, ratingsCopy.difficulty, 2)).toBeChecked()

    // The beauty given, pressed again
    await scoreItem(page, ratingsCopy.beauty, 5).click()

    // Chosen no more, the difficulty still standing
    await expect(scoreItem(page, ratingsCopy.beauty, 5)).not.toBeChecked()
    await expect(scoreItem(page, ratingsCopy.difficulty, 2)).toBeChecked()

    // Then the difficulty given, pressed again
    await scoreItem(page, ratingsCopy.difficulty, 2).click()

    // Chosen no more either
    await expect(scoreItem(page, ratingsCopy.difficulty, 2)).not.toBeChecked()

    // Sent as the difficulty alone, then as a rating scoring nothing, which takes it back
    await expect
      .poll(() => writes().map((write) => write.postDataJSON()))
      .toEqual([
        { beauty: null, difficulty: 2 },
        { beauty: null, difficulty: null },
      ])

    // The menu, closed from the keyboard
    await page.keyboard.press('Escape')

    // The card counting the other reviewer alone
    await expect(ratingsMark(page, ALGEBRA, 1)).toBeVisible()
  })

  test('steps along a row of scores with the left arrow, and through every score in turn with the down arrow', async ({
    page,
  }) => {
    // A reviewer who gave the algebra problem a beauty of 5
    await stubSelection(page, 'selection')

    // The pool
    await openPool(page)

    // The menu on the problem's card
    await actionsButton(cardOf(page, ALGEBRA), ALGEBRA).click()

    // The beauty given, focused
    await scoreItem(page, ratingsCopy.beauty, 5).focus()

    // Left along the beauty row, which the menu's own keys walk only up and down
    await page.keyboard.press('ArrowLeft')

    // Onto the score below it
    await expect(scoreItem(page, ratingsCopy.beauty, 4)).toBeFocused()

    // Down, which the menu's own keys handle
    await page.keyboard.press('ArrowDown')

    // Onto the next score in turn, still in the beauty row
    await expect(scoreItem(page, ratingsCopy.beauty, 5)).toBeFocused()
  })

  test('shows who rated a problem and how, behind its count, with the average of each aspect', async ({
    page,
  }) => {
    // The algebra problem, rated by another reviewer on its beauty alone and by the reader on every aspect
    await stubSelection(page, 'selection')

    // The pool
    await openPool(page)

    // The count, hovered
    await ratingsMark(page, ALGEBRA, 2).hover()

    // The header, a row per reviewer with a dash for a score left out, and each aspect's average over who scored it
    await expect(page.getByRole('tooltip').getByRole('row')).toHaveText([
      `${ratingsCopy.name}${ratingsCopy.beauty}${ratingsCopy.difficulty}`,
      `${OTHER_RATER}4–`,
      `${READER_NAME}52`,
      `${ratingsCopy.average}4.52`,
    ])
  })
})
