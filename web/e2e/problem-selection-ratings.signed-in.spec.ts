import type { Locator, Page } from '@playwright/test'

import {
  DETAIL_TAB_PARAM,
  detailQuery,
  POOL_VIEW_PARAM,
} from '@/components/features/problem-selection/model/selection-routes'
import type {
  Proposal,
  RatingScore,
} from '@/components/features/problem-selection/model/selection-types'

import { READER_NAME } from './support/comments'
import { SELECTION_PATH } from './support/competitions'
import {
  actionsButton,
  addressedParam,
  ALGEBRA,
  BILINGUAL,
  cardOf,
  FIRST,
  GEOMETRY,
  headingOf,
  isProposalWrite,
  LATER_DRAFT,
  ON_OFFER,
  OPENED,
  openPool,
  OTHER_RATER,
  READY,
  recordWrites,
  selectedTab,
  SELECTION_ENDPOINT,
  selectionCopy,
  selectionText,
  SETTLE_TIMEOUT_MS,
  stubSelection,
  UNWRITTEN,
} from './support/problem-selection'
import { expect, test } from './support/test'

/** The rating copy. */
const ratingsCopy = selectionCopy.ratings

/** The advanced paper of the later draft, {@link GEOMETRY} its one problem. */
const ADVANCED = LATER_DRAFT.papers[1]

/**
 * The table of the problems' ratings on screen.
 *
 * @param page - The page.
 *
 * @returns The table.
 */
function ratingsTable(page: Page): Locator {
  // The page's only table named for the ratings
  return page.getByRole('table', { name: ratingsCopy.tableLabel })
}

/**
 * The heading of each row of the ratings table, naming its problem.
 *
 * @param page - The page.
 *
 * @returns The row headings, in the rows' order.
 */
function rowHeadings(page: Page): Locator {
  // Every row heading in the table
  return ratingsTable(page).getByRole('rowheader')
}

/**
 * A problem's row in the ratings table.
 *
 * @param page - The page.
 * @param proposal - The problem.
 *
 * @returns The row.
 */
function rowOf(page: Page, proposal: Proposal): Locator {
  // The table's only row naming the problem
  return ratingsTable(page).getByRole('row').filter({ hasText: proposal.title })
}

/**
 * A column's header in the ratings table.
 *
 * @param page - The page.
 * @param name - What the column is called.
 *
 * @returns The header.
 */
function columnHeader(page: Page, name: string): Locator {
  // The table's only header naming the column
  return ratingsTable(page).getByRole('columnheader', { name })
}

/**
 * The button ordering the ratings table by a column.
 *
 * @param page - The page.
 * @param name - What the column is called.
 *
 * @returns The button.
 */
function sortHeader(page: Page, name: string): Locator {
  // The button in the column's header
  return columnHeader(page, name).getByRole('button')
}

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

test.describe('the ratings table', () => {
  test('lays the pool out as a table of its ratings, kept in the address so Back from a problem lands on it', async ({
    page,
  }) => {
    // A selection three of whose problems on offer are rated
    await stubSelection(page, 'rated')

    // The pool
    await openPool(page)

    // Laid out as ratings
    await page
      .getByRole('radiogroup', { name: selectionCopy.pool.views.label })
      .getByRole('radio', { name: selectionCopy.pool.views.ratings })
      .click()

    // A row per problem on offer, lowest number first, in the cards' place
    await expect(rowHeadings(page)).toHaveText(ON_OFFER.map((proposal) => proposal.title))
    await expect(page.getByRole('article')).toHaveCount(0)

    // Named in the address
    await expect.poll(() => addressedParam(page, POOL_VIEW_PARAM)).toBe('ratings')

    // The pool searched for the algebra problem
    await page.getByRole('searchbox', { name: selectionCopy.pool.search }).fill(ALGEBRA.title)

    // The table narrowed to the algebra problem
    await expect(rowHeadings(page)).toHaveText([ALGEBRA.title])

    // The algebra problem's row
    const row = rowOf(page, ALGEBRA)

    // How big the row is
    const box = await row.boundingBox()

    // A row not laid out has no right end to press
    if (!box) throw new Error("The algebra problem's row is not laid out")

    // Pressed at its right end, on the count of its raters, away from the problem's name
    await row.click({ position: { x: box.width - 4, y: box.height / 2 } })

    // The problem's own page
    await expect(headingOf(page, ALGEBRA)).toBeVisible()

    // Back
    await page.goBack()

    // The table again, still narrowed, focus on the problem's name
    await expect(rowHeadings(page)).toHaveText([ALGEBRA.title])
    await expect(rowOf(page, ALGEBRA).getByRole('link')).toBeFocused()

    // The problem again, from its name
    await rowOf(page, ALGEBRA).getByRole('link').click()

    // Left by the page's own way back to the pool
    await page.getByRole('link', { name: selectionCopy.detail.backToPool }).click()

    // The table once more, still narrowed
    await expect(rowHeadings(page)).toHaveText([ALGEBRA.title])
  })

  test('shows behind an average who gave that aspect a score, leaving out who scored only the other', async ({
    page,
  }) => {
    // A selection whose algebra problem another reviewer scored on beauty alone, and the reader on both
    await stubSelection(page, 'rated')

    // The pool, laid out as ratings by its address
    await page.goto(`${SELECTION_PATH}?${POOL_VIEW_PARAM}=ratings`)

    // The algebra problem's difficulty, hovered
    await rowOf(page, ALGEBRA)
      .getByRole('cell')
      .nth(2)
      .getByRole('button')
      .hover({ timeout: SETTLE_TIMEOUT_MS })

    // The difficulty alone, given by the reader alone, and its average
    await expect(page.getByRole('tooltip').getByRole('row')).toHaveText([
      `${ratingsCopy.name}${ratingsCopy.difficulty}`,
      `${READER_NAME}2`,
      `${ratingsCopy.average}2`,
    ])
  })

  test('orders the rows by an aspect from the highest, then turned round, the problems nobody scored last either way', async ({
    page,
  }) => {
    // A selection three of whose problems on offer are rated
    await stubSelection(page, 'rated')

    // The pool, laid out as ratings by its address
    await page.goto(`${SELECTION_PATH}?${POOL_VIEW_PARAM}=ratings`)

    // Lowest number first
    await expect(rowHeadings(page)).toHaveText(
      ON_OFFER.map((proposal) => proposal.title),
      {
        timeout: SETTLE_TIMEOUT_MS,
      }
    )

    // Ordered by beauty
    await sortHeader(page, ratingsCopy.beauty).click()

    // 5, 4.5 and 3, then the problems nobody scored on beauty by number
    await expect(rowHeadings(page)).toHaveText(
      [BILINGUAL, ALGEBRA, GEOMETRY, FIRST, OPENED, READY, UNWRITTEN].map(
        (proposal) => proposal.title
      )
    )

    // Turned round
    await sortHeader(page, ratingsCopy.beauty).click()

    // 3, 4.5 and 5, the problems nobody scored still last
    await expect(rowHeadings(page)).toHaveText(
      [GEOMETRY, ALGEBRA, BILINGUAL, FIRST, OPENED, READY, UNWRITTEN].map(
        (proposal) => proposal.title
      )
    )
  })

  test("puts a paper's ratings on its last tab, named in the address, which Back from a problem lands on as it was left", async ({
    page,
  }) => {
    // A selection three of whose problems on offer are rated
    await stubSelection(page, 'rated')

    // The advanced paper of the later draft
    await page.goto(
      `${SELECTION_PATH}?${detailQuery({ kind: 'paper', id: ADVANCED.id, tab: undefined })}`
    )

    // The paper's tabs
    const tabs = page.getByRole('tablist', { name: selectionCopy.paper.tabsLabel }).getByRole('tab')

    // The ratings tab, the last of them
    await expect(tabs.last()).toHaveAccessibleName(selectionCopy.paper.ratingsTab, {
      timeout: SETTLE_TIMEOUT_MS,
    })

    // The ratings, picked
    await tabs.last().click()

    // Named in the address
    await expect.poll(() => addressedParam(page, DETAIL_TAB_PARAM)).toBe('ratings')

    // The paper's one problem, with its number, its beauty, its difficulty and how many rated it
    await expect(rowHeadings(page)).toHaveText([GEOMETRY.title])
    await expect(rowOf(page, GEOMETRY).getByRole('cell')).toHaveText(['6', '3', '5', '1'])

    // Ordered by beauty
    await sortHeader(page, ratingsCopy.beauty).click()

    // The problem, opened from its name
    await rowOf(page, GEOMETRY).getByRole('link').click()

    // The problem's own page
    await expect(headingOf(page, GEOMETRY)).toBeVisible()

    // Back
    await page.goBack()

    // The paper again, on its ratings, focus on the problem's name
    await expect(selectedTab(page, selectionCopy.paper.tabsLabel)).toContainText(
      selectionCopy.paper.ratingsTab
    )
    await expect(rowHeadings(page)).toHaveText([GEOMETRY.title])
    await expect(rowOf(page, GEOMETRY).getByRole('link')).toBeFocused()

    // Still ordered by beauty, from the best
    await expect(columnHeader(page, ratingsCopy.beauty)).toHaveAttribute('aria-sort', 'descending')
  })
})
