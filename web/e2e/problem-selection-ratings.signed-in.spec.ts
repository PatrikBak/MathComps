import type { Locator, Page } from '@playwright/test'

import {
  DETAIL_TAB_PARAM,
  detailQuery,
  POOL_VIEW_PARAM,
} from '@/components/features/problem-selection/model/selection-routes'
import type { Proposal } from '@/components/features/problem-selection/model/selection-types'

import { refuse } from './support/backend-routes'
import { READER_NAME } from './support/comments'
import { holdClock, SELECTION_PATH } from './support/competitions'
import {
  actionsButton,
  addressedParam,
  ALGEBRA,
  BILINGUAL,
  cardOf,
  FIRST,
  GEOMETRY,
  headingOf,
  holdReads,
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
 * One aspect's bar of scores in a problem's menu.
 *
 * @param page - The page, with the menu open.
 * @param aspect - What the aspect is called.
 *
 * @returns The bar.
 */
function scoreBar(page: Page, aspect: string): Locator {
  // The slider named for the aspect
  return page.getByRole('slider', { name: aspect })
}

/**
 * A point on a bar of scores, from its top-left corner.
 */
type BarPoint = {
  /** How far right of the bar's left edge. */
  x: number
  /** How far below the bar's top edge. */
  y: number
}

/**
 * Where a step sits along a bar of scores: in the middle of the stretch it fills past the step below, the bar running
 * from no score at its left edge to 5 at its right.
 *
 * @param bar - The bar.
 * @param score - The step.
 *
 * @returns The point.
 */
async function stepPoint(bar: Locator, score: number): Promise<BarPoint> {
  // The bar settled where the menu's opening leaves it
  await bar.click({ trial: true })

  // The bar's box
  const box = await bar.boundingBox()

  // A bar that isn't on screen has no steps to press
  if (box === null) throw new Error('The bar is not on screen')

  // A quarter of a whole score short of the step, halfway down the bar
  return { x: (box.width * (score - 0.25)) / 5, y: box.height / 2 }
}

/**
 * Presses one step along a bar of scores.
 *
 * @param bar - The bar.
 * @param score - The step.
 */
async function pressStep(bar: Locator, score: number): Promise<void> {
  // The step clicked
  await bar.click({ position: await stepPoint(bar, score) })
}

/**
 * How much of a bar of scores its fill covers.
 *
 * @param bar - The bar.
 *
 * @returns The fill's width, as a share of the bar's.
 */
function fillShare(bar: Locator): Promise<number> {
  // The fill's width over the bar's, the fill being the bar's first child
  return bar.evaluate(
    (element) =>
      (element.firstElementChild?.getBoundingClientRect().width ?? 0) /
      element.getBoundingClientRect().width
  )
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

    // A beauty of 3.5, the left half of the box holding 4
    await pressStep(scoreBar(page, ratingsCopy.beauty), 3.5)

    // A difficulty of 2 straight after, the first write possibly still out
    await pressStep(scoreBar(page, ratingsCopy.difficulty), 2)

    // Both given, the menu still open
    await expect(scoreBar(page, ratingsCopy.beauty)).toHaveAttribute('aria-valuenow', '3.5')
    await expect(scoreBar(page, ratingsCopy.difficulty)).toHaveAttribute('aria-valuenow', '2')

    // Each write stating the whole rating as it then stood, the second keeping the first's beauty
    await expect
      .poll(() => writes().map((write) => [write.method(), write.url(), write.postDataJSON()]))
      .toEqual([
        [
          'PUT',
          `${SELECTION_ENDPOINT}/proposals/${FIRST.id}/rating`,
          { beauty: 3.5, difficulty: null },
        ],
        [
          'PUT',
          `${SELECTION_ENDPOINT}/proposals/${FIRST.id}/rating`,
          { beauty: 3.5, difficulty: 2 },
        ],
      ])

    // The menu, closed from the keyboard
    await page.keyboard.press('Escape')

    // The card counting one reviewer, the reader
    await expect(ratingsMark(page, FIRST, 1)).toBeVisible()
  })

  test('moves a score a tenth with the arrows beside it, the menu staying open', async ({
    page,
  }) => {
    // A reviewer whose pool's first problem nobody has rated
    await stubSelection(page, 'selection')

    // Every write the page sends to a problem
    const writes = recordWrites(page, isProposalWrite)

    // The pool
    await openPool(page)

    // The menu on the problem's card
    await actionsButton(cardOf(page, FIRST), FIRST).click()

    // A beauty of 3.5 from the bar
    await pressStep(scoreBar(page, ratingsCopy.beauty), 3.5)

    // The arrow raising the beauty a tenth
    const raise = page.getByRole('button', {
      name: selectionText('ratings.raiseScore', { aspect: ratingsCopy.beauty }),
    })

    // Pressed twice
    await raise.click()
    await raise.click()

    // On 3.7, the menu still open
    await expect(scoreBar(page, ratingsCopy.beauty)).toHaveAttribute('aria-valuenow', '3.7')

    // Each tenth written
    await expect
      .poll(() => writes().map((write) => write.postDataJSON()))
      .toEqual([
        { beauty: 3.5, difficulty: null },
        { beauty: 3.6, difficulty: null },
        { beauty: 3.7, difficulty: null },
      ])
  })

  test('takes a score back with the cross beside it, and the rating with its last score', async ({
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

    // The reader's scores on the bars
    await expect(scoreBar(page, ratingsCopy.beauty)).toHaveAttribute('aria-valuenow', '5')
    await expect(scoreBar(page, ratingsCopy.difficulty)).toHaveAttribute('aria-valuenow', '2')

    // The beauty's cross
    await page
      .getByRole('button', {
        name: selectionText('ratings.clearScore', { aspect: ratingsCopy.beauty }),
      })
      .click()

    // Given no more, the difficulty still standing
    await expect(scoreBar(page, ratingsCopy.beauty)).toHaveAttribute(
      'aria-valuetext',
      ratingsCopy.noScore
    )
    await expect(scoreBar(page, ratingsCopy.difficulty)).toHaveAttribute('aria-valuenow', '2')

    // Then the difficulty's cross
    await page
      .getByRole('button', {
        name: selectionText('ratings.clearScore', { aspect: ratingsCopy.difficulty }),
      })
      .click()

    // Given no more either
    await expect(scoreBar(page, ratingsCopy.difficulty)).toHaveAttribute(
      'aria-valuetext',
      ratingsCopy.noScore
    )

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

  test('sets the step a drag along a bar lets go on, with one write', async ({ page }) => {
    // A reviewer whose pool's first problem nobody has rated
    await stubSelection(page, 'selection')

    // Every write the page sends to a problem
    const writes = recordWrites(page, isProposalWrite)

    // The pool
    await openPool(page)

    // The menu on the problem's card
    await actionsButton(cardOf(page, FIRST), FIRST).click()

    // The beauty's bar
    const bar = scoreBar(page, ratingsCopy.beauty)

    // The steps the drag goes down on and lets go on, once the menu has settled
    const [from, to] = [await stepPoint(bar, 1), await stepPoint(bar, 4.5)]

    // Where on the page the bar sits
    const box = await bar.boundingBox()

    // A bar that isn't on screen can't be dragged
    if (box === null) throw new Error('The beauty bar is not on screen')

    // Pressed on the lowest step
    await page.mouse.move(box.x + from.x, box.y + from.y)
    await page.mouse.down()

    // Dragged along to 4.5, the press still held
    await page.mouse.move(box.x + to.x, box.y + to.y, { steps: 8 })

    // The bar filled to the step under the pointer, nine tenths of the way
    await expect.poll(() => fillShare(bar)).toBeCloseTo(0.9)

    // Nothing written while the press is held
    expect(writes()).toHaveLength(0)

    // Let go
    await page.mouse.up()

    // The step let go on given
    await expect(bar).toHaveAttribute('aria-valuenow', '4.5')

    // Written once, as the step let go on
    await expect
      .poll(() => writes().map((write) => write.postDataJSON()))
      .toEqual([{ beauty: 4.5, difficulty: null }])
  })

  test('moves a score a tenth with the left and right arrows, half a score with Shift, writing it once the keys stop, and leaves up and down to the menu', async ({
    page,
  }) => {
    // A clock the spec can hold still, so every key lands before any of their scores could be written
    await page.clock.install()

    // A reviewer who gave the algebra problem a beauty of 5 and a difficulty of 2
    await stubSelection(page, 'selection')

    // Every write the page sends to a problem
    const writes = recordWrites(page, isProposalWrite)

    // The pool
    await openPool(page)

    // The menu on the problem's card
    await actionsButton(cardOf(page, ALGEBRA), ALGEBRA).click()

    // The beauty's bar, focused
    await scoreBar(page, ratingsCopy.beauty).focus()

    // Time stopped while the keys come
    await holdClock(page)

    // Left, a tenth down
    await page.keyboard.press('ArrowLeft')

    // On 4.9
    await expect(scoreBar(page, ratingsCopy.beauty)).toHaveAttribute('aria-valuenow', '4.9')

    // Left with Shift, half a score down
    await page.keyboard.press('Shift+ArrowLeft')

    // On 4.4
    await expect(scoreBar(page, ratingsCopy.beauty)).toHaveAttribute('aria-valuenow', '4.4')

    // Right, a tenth back up
    await page.keyboard.press('ArrowRight')

    // On 4.5
    await expect(scoreBar(page, ratingsCopy.beauty)).toHaveAttribute('aria-valuenow', '4.5')

    // Nothing written while the keys keep coming
    expect(writes()).toHaveLength(0)

    // The keys stopped for a second
    await page.clock.runFor(1000)

    // Written once, as the keys left it, the difficulty kept
    await expect
      .poll(() => writes().map((write) => write.postDataJSON()))
      .toEqual([{ beauty: 4.5, difficulty: 2 }])

    // Time running again
    await page.clock.resume()

    // Down, which the menu's own keys handle
    await page.keyboard.press('ArrowDown')

    // Onto the difficulty's bar
    await expect(scoreBar(page, ratingsCopy.difficulty)).toBeFocused()
  })

  test("writes the scores keys set on two of a problem's aspects as one write, the moment the menu closes", async ({
    page,
  }) => {
    // A clock the spec can hold still, so the menu closes before any key's score could be written
    await page.clock.install()

    // A reviewer who gave the algebra problem a beauty of 5 and a difficulty of 2
    await stubSelection(page, 'selection')

    // Every write the page sends to a problem
    const writes = recordWrites(page, isProposalWrite)

    // The pool
    await openPool(page)

    // The menu on the problem's card
    await actionsButton(cardOf(page, ALGEBRA), ALGEBRA).click()

    // The beauty's bar, focused
    await scoreBar(page, ratingsCopy.beauty).focus()

    // Time stopped while the keys come
    await holdClock(page)

    // Left on the beauty, a tenth down
    await page.keyboard.press('ArrowLeft')

    // On 4.9
    await expect(scoreBar(page, ratingsCopy.beauty)).toHaveAttribute('aria-valuenow', '4.9')

    // The difficulty's bar, focused
    await scoreBar(page, ratingsCopy.difficulty).focus()

    // Right on the difficulty, a tenth up
    await page.keyboard.press('ArrowRight')

    // On 2.1
    await expect(scoreBar(page, ratingsCopy.difficulty)).toHaveAttribute('aria-valuenow', '2.1')

    // The menu, closed from the keyboard before either key's score is written
    await page.keyboard.press('Escape')

    // The menu gone, its bars with it
    await expect(scoreBar(page, ratingsCopy.beauty)).toHaveCount(0)

    // Written once as the menu closed, carrying each aspect's new score
    await expect
      .poll(() => writes().map((write) => write.postDataJSON()))
      .toEqual([{ beauty: 4.9, difficulty: 2.1 }])
  })

  test('writes a press on a bar at once, carrying a score a key left waiting on another aspect', async ({
    page,
  }) => {
    // A clock the spec can hold still, so the press comes while the key's score still waits
    await page.clock.install()

    // A reviewer who gave the algebra problem a beauty of 5 and a difficulty of 2
    await stubSelection(page, 'selection')

    // Every write the page sends to a problem
    const writes = recordWrites(page, isProposalWrite)

    // The pool
    await openPool(page)

    // The menu on the problem's card
    await actionsButton(cardOf(page, ALGEBRA), ALGEBRA).click()

    // The beauty's bar, focused
    await scoreBar(page, ratingsCopy.beauty).focus()

    // Time stopped while the key's score waits
    await holdClock(page)

    // Left on the beauty, a tenth down
    await page.keyboard.press('ArrowLeft')

    // On 4.9
    await expect(scoreBar(page, ratingsCopy.beauty)).toHaveAttribute('aria-valuenow', '4.9')

    // A difficulty of 3 from its bar
    await pressStep(scoreBar(page, ratingsCopy.difficulty), 3)

    // Written at once, carrying the beauty the key left
    await expect
      .poll(() => writes().map((write) => write.postDataJSON()))
      .toEqual([{ beauty: 4.9, difficulty: 3 }])

    // Long past when the key's own score would have been written
    await page.clock.runFor(1000)

    // Time running again
    await page.clock.resume()

    // The beauty raised a tenth from its arrow, a write that lands after anything the key still had coming
    await page
      .getByRole('button', {
        name: selectionText('ratings.raiseScore', { aspect: ratingsCopy.beauty }),
      })
      .click()

    // Nothing between the two writes: the key's score went out with the press, never on its own
    await expect
      .poll(() => writes().map((write) => write.postDataJSON()))
      .toEqual([
        { beauty: 4.9, difficulty: 3 },
        { beauty: 5, difficulty: 3 },
      ])
  })

  test('keeps a score a key set while an earlier write of the rating lands on the page', async ({
    page,
  }) => {
    // A clock the spec can hold still, so the earlier write lands on the page only once the key is in
    await page.clock.install()

    // A reviewer whose pool's first problem nobody has rated
    await stubSelection(page, 'selection')

    // Every write the page sends to a problem
    const writes = recordWrites(page, isProposalWrite)

    // The pool
    await openPool(page)

    // The menu on the problem's card
    await actionsButton(cardOf(page, FIRST), FIRST).click()

    // The beauty's bar
    const bar = scoreBar(page, ratingsCopy.beauty)

    // Time stopped before the bar is pressed
    await holdClock(page)

    // A beauty of 3.5 from the bar, written at once
    await pressStep(bar, 3.5)

    // A tenth up from the keyboard, before that write has landed on the page
    await page.keyboard.press('ArrowRight')

    // On 3.6
    await expect(bar).toHaveAttribute('aria-valuenow', '3.6')

    // Long enough for the write of 3.5 to land on the page, short of the key's own write
    await page.clock.runFor(100)

    // The write of 3.5 landed, which the card's count of raters shows
    await expect(ratingsMark(page, FIRST, 1)).toBeVisible()

    // The bar still on the score the key set
    await expect(bar).toHaveAttribute('aria-valuenow', '3.6')

    // Another tenth up, from there
    await page.keyboard.press('ArrowRight')

    // Long past the wait before a key's score is written
    await page.clock.runFor(1000)

    // The press written, then the keys' score once
    await expect
      .poll(() => writes().map((write) => write.postDataJSON()))
      .toEqual([
        { beauty: 3.5, difficulty: null },
        { beauty: 3.7, difficulty: null },
      ])
  })

  test('puts a bar back on the score the backend holds when it refuses the write', async ({
    page,
  }) => {
    // A reviewer who gave the algebra problem a beauty of 5 and a difficulty of 2
    await stubSelection(page, 'selection')

    // Where the problem's rating is written
    const ratingAddress = `${SELECTION_ENDPOINT}/proposals/${ALGEBRA.id}/rating`

    // Every write of the rating refused
    await page.route(ratingAddress, (route) => refuse(route, 400, 'ProposalRatingValue'))

    // The pool
    await openPool(page)

    // The menu on the problem's card
    await actionsButton(cardOf(page, ALGEBRA), ALGEBRA).click()

    // Every read held from here, so the page has only the refusal to go on
    const releaseReads = await holdReads(page)

    // The refusal, once it comes
    const refused = page.waitForResponse(ratingAddress)

    // A beauty of 3 from the bar
    await pressStep(scoreBar(page, ratingsCopy.beauty), 3)

    // Refused
    await refused

    // The bar back on the 5 the backend holds
    await expect(scoreBar(page, ratingsCopy.beauty)).toHaveAttribute('aria-valuenow', '5')

    // The reads let through again
    releaseReads()
  })

  test('fills a bar to the score its arrow keys set while the mouse rests on another step', async ({
    page,
  }) => {
    // A reviewer whose pool's first problem nobody has rated
    await stubSelection(page, 'selection')

    // The pool
    await openPool(page)

    // The menu on the problem's card
    await actionsButton(cardOf(page, FIRST), FIRST).click()

    // The beauty's bar
    const bar = scoreBar(page, ratingsCopy.beauty)

    // A beauty of 3.5 from the bar, the mouse left on it
    await pressStep(bar, 3.5)

    // A tenth up from the keyboard
    await page.keyboard.press('ArrowRight')

    // Where the 3.5 step sits, and where on the page the bar does
    const [point, box] = [await stepPoint(bar, 3.5), await bar.boundingBox()]

    // A bar that isn't on screen can't be hovered
    if (box === null) throw new Error('The beauty bar is not on screen')

    // The mouse nudged along that step, which a press would now give in place of 3.6
    await page.mouse.move(box.x + point.x + 2, box.y + point.y)

    // Another tenth up
    await page.keyboard.press('ArrowRight')

    // The bar filled to 3.7, not to the step under the mouse
    await expect.poll(() => fillShare(bar)).toBeCloseTo(0.74)
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
      `${OTHER_RATER}3.5–`,
      `${READER_NAME}5.02.0`,
      `${ratingsCopy.average}4.252.0`,
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
      `${READER_NAME}2.0`,
      `${ratingsCopy.average}2.0`,
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

    // 5, 4.25 and 3, then the problems nobody scored on beauty by number
    await expect(rowHeadings(page)).toHaveText(
      [BILINGUAL, ALGEBRA, GEOMETRY, FIRST, OPENED, READY, UNWRITTEN].map(
        (proposal) => proposal.title
      )
    )

    // Turned round
    await sortHeader(page, ratingsCopy.beauty).click()

    // 3, 4.25 and 5, the problems nobody scored still last
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
    await expect(rowOf(page, GEOMETRY).getByRole('cell')).toHaveText(['6', '3.0', '5.0', '1'])

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
