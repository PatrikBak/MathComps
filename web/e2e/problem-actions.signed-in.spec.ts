import type { Locator, Page } from '@playwright/test'

import messages from '../messages/en.json'
import { filtersCopy } from './support/archive-filters'
import { PROBLEMS_PATH, recordNotices, stubUserLists } from './support/backend-routes'
import {
  ACTION_DELAY_MS,
  recordListReadings,
  searchAnswerWith,
  stubProblemActions,
  stubSearchAnswer,
  stubSearchRule,
} from './support/problem-actions'
import { expect, test } from './support/test'

/** The copy the problem cards and their toasts read under, taken from the app's own messages. */
const problemsCopy = messages.problems

/**
 * How long the library needs to settle: boot Clerk, resolve who is reading, and draw the rows off
 * the search it sends once it knows.
 */
const SETTLE_TIMEOUT_MS = 15_000

/**
 * How long to watch a settled list before calling it final, which has to outlast an action the
 * backend is still thinking about plus the search its answer sets off.
 */
const QUIET_MS = ACTION_DELAY_MS + 2000

/** The problem each test acts on. */
const EDITED = 'tst-2020-1'

/** A second problem, there to show that what happens to the first is about the first. */
const UNTOUCHED = 'tst-2020-2'

/** The list the reader keeps, for the cases about a problem's place in one. */
const LIST_ID = 'study-group'

/** What that list is called wherever the reader is offered it. */
const LIST_NAME = 'Study group'

/**
 * The rows on screen right now.
 *
 * @param page - The page to read.
 *
 * @returns The slugs, in the order the list draws them.
 */
async function rowsOn(page: Page): Promise<string[]> {
  // Each row states which problem it is, which is what the list amounts to for these tests
  return page
    .locator('[data-problem-slug]')
    .evaluateAll((rows) => rows.map((row) => row.getAttribute('data-problem-slug') ?? ''))
}

/**
 * One problem's row, wherever the list has drawn it.
 *
 * @param page - The page it is drawn on.
 * @param slug - The problem it is about.
 *
 * @returns The row.
 */
function rowFor(page: Page, slug: string): Locator {
  // A row states which problem it is, which is the only handle these tests need on it
  return page.locator(`[data-problem-slug="${slug}"]`)
}

/**
 * One of the buttons a reader acts on a problem with, on that problem's own row.
 *
 * @param page - The page the row is drawn on.
 * @param slug - The problem it is about.
 * @param title - What the button is called, which is what tells the row's buttons apart.
 *
 * @returns The button.
 */
function actionOn(page: Page, slug: string, title: string): Locator {
  // Reached through the row, since every other row carries a button of the same name
  return rowFor(page, slug).locator(`button[title="${title}"]`)
}

/**
 * Opens the sidebar dropdown that picks which body of problems the library is showing.
 *
 * @param page - The page to open it on.
 * @param currentLabel - What the library is narrowed to now, which is what the trigger reads under.
 */
async function openListsMenu(page: Page, currentLabel: string): Promise<void> {
  // The trigger names whatever is showing, and lives in the sidebar rather than in the panel it opens
  await page.getByRole('complementary').getByRole('button', { name: currentLabel }).click()
}

/**
 * Picks a mark status from the toolbar's dropdown.
 *
 * @param page - The page to pick it on.
 * @param label - The status to pick.
 */
async function pickMarkStatus(page: Page, label: string): Promise<void> {
  // The trigger reads under the status it currently holds, so it is addressed by its fixed title
  await page.locator(`button[title="${filtersCopy.markStatus}"]`).click()

  // Every status is a row of the menu, matched whole because one of them is a word inside another
  await page.getByRole('menuitem', { name: label, exact: true }).click()
}

test.describe('acting on a problem while a filter holds it on screen', () => {
  test('takes an unliked problem off a screen of the reader’s own likes', async ({ page }) => {
    // Every reading the list takes, since a row taken away and put back is over before a check
    const readings = await recordListReadings(page)

    // Two problems the reader has liked, which is what a screen of their likes holds
    await stubSearchAnswer(
      page,
      searchAnswerWith({ [EDITED]: { liked: true }, [UNTOUCHED]: { liked: true } })
    )

    // The backend, made slow enough that the app has to answer for the screen on its own
    await stubProblemActions(page)

    // Open the reader's likes
    await page.goto(`${PROBLEMS_PATH}?favoritesOnly=true`)

    // A row to act on
    await expect(rowFor(page, EDITED)).toBeVisible({
      timeout: SETTLE_TIMEOUT_MS,
    })

    // Where the log stood once the list had settled
    const readingsBeforeClick = readings().length

    // One of them unliked
    await actionOn(page, EDITED, problemsCopy.unlike).click()

    // It goes at once, on the app's say-so, while the backend is still thinking about it
    await expect(rowFor(page, EDITED)).toHaveCount(0, { timeout: 1000 })

    // The list drew at least once more, so the frames checked below are frames rather than none
    expect(readings().length).toBeGreaterThan(readingsBeforeClick)

    // And the problem the reader said nothing about was on screen in every one of them, which a row
    // taken away and put back would fail while still being on screen by the end
    expect(
      readings()
        .slice(readingsBeforeClick)
        .filter((reading) => !reading.slugs.includes(UNTOUCHED))
    ).toEqual([])
  })

  test('puts the row back when the reader takes the unlike back', async ({ page }) => {
    // Every action accepted, slowly
    const actions = await stubProblemActions(page)

    // An archive answering as the reader's likes actually stand. One frozen at how they started
    // hands the row back on the refetch the unlike itself sets off, and the undo proves nothing.
    const searches = await stubSearchRule(page, () =>
      searchAnswerWith(
        actions().length === 1
          ? { [UNTOUCHED]: { liked: true } }
          : { [EDITED]: { liked: true }, [UNTOUCHED]: { liked: true } }
      )
    )

    // Open the reader's likes
    await page.goto(`${PROBLEMS_PATH}?favoritesOnly=true`)

    // A row to act on
    await expect(rowFor(page, EDITED)).toBeVisible({
      timeout: SETTLE_TIMEOUT_MS,
    })

    // Unliked, which takes it off the screen
    await actionOn(page, EDITED, problemsCopy.unlike).click()

    // The reader is offered it back, which is the whole point of taking it away this quickly
    await expect(page.getByText(problemsCopy.favorites.removedFromFavorites)).toBeVisible({
      timeout: SETTLE_TIMEOUT_MS,
    })

    // The archive has since been asked again
    await expect.poll(() => searches().length, { timeout: SETTLE_TIMEOUT_MS }).toBeGreaterThan(1)

    // And agreed the problem is gone, so nothing but the undo can account for the row coming back
    await expect(rowFor(page, EDITED)).toHaveCount(0)

    // And takes the offer
    await page.getByRole('button', { name: problemsCopy.favorites.undo }).click()

    // The row comes back, since the archive was told the like is back on and answered with it
    await expect(rowFor(page, EDITED)).toBeVisible({
      timeout: SETTLE_TIMEOUT_MS,
    })
  })

  test('takes an unmarked problem off a screen of marked ones', async ({ page }) => {
    // Every reading the list takes, since a row taken away and put back is over before a check
    const readings = await recordListReadings(page)

    // Two problems the reader has marked, which is what the marked screen holds
    await stubSearchAnswer(
      page,
      searchAnswerWith({ [EDITED]: { marked: true }, [UNTOUCHED]: { marked: true } })
    )

    // Every action accepted, slowly
    await stubProblemActions(page)

    // Open the marked problems
    await page.goto(`${PROBLEMS_PATH}?markStatus=marked`)

    // A row to act on
    await expect(rowFor(page, EDITED)).toBeVisible({
      timeout: SETTLE_TIMEOUT_MS,
    })

    // Where the log stood once the list had settled
    const readingsBeforeClick = readings().length

    // The mark taken off one of them
    await actionOn(page, EDITED, problemsCopy.marks.unmark).click()

    // Which is the reader saying it does not belong on this screen
    await expect(rowFor(page, EDITED)).toHaveCount(0, { timeout: 1000 })

    // The list drew at least once more, so the frames checked below are frames rather than none
    expect(readings().length).toBeGreaterThan(readingsBeforeClick)

    // The other one is none of its business, in every one of them
    expect(
      readings()
        .slice(readingsBeforeClick)
        .filter((reading) => !reading.slugs.includes(UNTOUCHED))
    ).toEqual([])
  })

  test('takes an unmarked problem off a screen of the reader’s marked likes', async ({ page }) => {
    // Every reading the list takes, since a row taken away and put back is over before a check
    const readings = await recordListReadings(page)

    // Two problems the reader both likes and has marked, which is what such a screen holds
    await stubSearchAnswer(
      page,
      searchAnswerWith({
        [EDITED]: { liked: true, marked: true },
        [UNTOUCHED]: { liked: true, marked: true },
      })
    )

    // Every action accepted, slowly
    await stubProblemActions(page)

    // Open the marked ones among the reader's own likes
    await page.goto(`${PROBLEMS_PATH}?favoritesOnly=true&markStatus=marked`)

    // A row to act on
    await expect(rowFor(page, EDITED)).toBeVisible({
      timeout: SETTLE_TIMEOUT_MS,
    })

    // Where the log stood once the list had settled
    const readingsBeforeClick = readings().length

    // The mark taken off, with the like left on
    await actionOn(page, EDITED, problemsCopy.marks.unmark).click()

    // One of the two filters is enough to rule it off, however well it answers the other
    await expect(rowFor(page, EDITED)).toHaveCount(0, { timeout: 1000 })

    // The list drew at least once more, so the frames checked below are frames rather than none
    expect(readings().length).toBeGreaterThan(readingsBeforeClick)

    // And the row nobody touched answers both, in every one of them
    expect(
      readings()
        .slice(readingsBeforeClick)
        .filter((reading) => !reading.slugs.includes(UNTOUCHED))
    ).toEqual([])
  })

  test('takes a problem dropped from a list off the screen of that list', async ({ page }) => {
    // One list of the reader's, holding both problems
    await stubUserLists(page, () => ({
      likedCount: 0,
      lists: [{ contentId: LIST_ID, name: LIST_NAME, problemCount: 2, isShared: false }],
    }))

    // Which is what the list's own screen is answered with
    await stubSearchAnswer(
      page,
      searchAnswerWith({
        [EDITED]: { listContentIds: [LIST_ID] },
        [UNTOUCHED]: { listContentIds: [LIST_ID] },
      })
    )

    // Every action accepted, slowly
    await stubProblemActions(page)

    // Open the list
    await page.goto(`${PROBLEMS_PATH}?list=${LIST_ID}`)

    // A row to act on
    await expect(rowFor(page, EDITED)).toBeVisible({
      timeout: SETTLE_TIMEOUT_MS,
    })

    // Taken out of the very list being browsed, which is the ticked row of its own menu
    await actionOn(page, EDITED, problemsCopy.addToList).click()
    await page.getByRole('dialog').getByRole('button', { name: LIST_NAME }).click()

    // A list holds what the reader put in it, so this is them saying it does not belong here
    await expect(rowFor(page, EDITED)).toHaveCount(0, { timeout: 1000 })

    // And they are offered it back, since the row went before the backend had answered
    await expect(page.getByText(problemsCopy.removedFromList)).toBeVisible({
      timeout: SETTLE_TIMEOUT_MS,
    })
  })
})

test.describe('acting on a problem the backend turns down', () => {
  test('brings the row back when the backend turns the unlike down', async ({ page }) => {
    // Everything the reader is told from here
    const notices = await recordNotices(page)

    // A screen of the reader's own likes
    await stubSearchAnswer(
      page,
      searchAnswerWith({ [EDITED]: { liked: true }, [UNTOUCHED]: { liked: true } })
    )

    // A backend that turns every action down
    await stubProblemActions(page, 'refused')

    // Open the reader's likes
    await page.goto(`${PROBLEMS_PATH}?favoritesOnly=true`)

    // A row to act on
    await expect(rowFor(page, EDITED)).toBeVisible({
      timeout: SETTLE_TIMEOUT_MS,
    })

    // Unliked, which the app takes off the screen before it knows whether it stuck
    await actionOn(page, EDITED, problemsCopy.unlike).click()

    // It did not stick, so the row belongs back where it was rather than gone on a promise nobody kept
    await expect(rowFor(page, EDITED)).toBeVisible({
      timeout: SETTLE_TIMEOUT_MS,
    })

    // And the reader is told, since a row that reappears on its own explains nothing
    await expect
      .poll(() => notices(), { timeout: SETTLE_TIMEOUT_MS })
      .toContain(problemsCopy.favorites.likeToggleFailed)
  })

  test('brings the row back when the backend turns the unmark down', async ({ page }) => {
    // Everything the reader is told from here
    const notices = await recordNotices(page)

    // A screen of the problems the reader has marked
    await stubSearchAnswer(
      page,
      searchAnswerWith({ [EDITED]: { marked: true }, [UNTOUCHED]: { marked: true } })
    )

    // A backend that turns every action down
    await stubProblemActions(page, 'refused')

    // Open the marked problems
    await page.goto(`${PROBLEMS_PATH}?markStatus=marked`)

    // A row to act on
    await expect(rowFor(page, EDITED)).toBeVisible({
      timeout: SETTLE_TIMEOUT_MS,
    })

    // The mark taken off, which the app takes off the screen before it knows whether it stuck
    await actionOn(page, EDITED, problemsCopy.marks.unmark).click()

    // The mark never came off, so the screen of marked problems still has a place for it
    await expect(rowFor(page, EDITED)).toBeVisible({
      timeout: SETTLE_TIMEOUT_MS,
    })

    // And the reader is told what became of what they asked for
    await expect
      .poll(() => notices(), { timeout: SETTLE_TIMEOUT_MS })
      .toContain(problemsCopy.marks.markToggleFailed)
  })

  test('brings the row back when the backend turns the list removal down', async ({ page }) => {
    // Everything the reader is told from here
    const notices = await recordNotices(page)

    // One list of the reader's, holding both problems
    await stubUserLists(page, () => ({
      likedCount: 0,
      lists: [{ contentId: LIST_ID, name: LIST_NAME, problemCount: 2, isShared: false }],
    }))

    // Which is what the list's own screen is answered with
    await stubSearchAnswer(
      page,
      searchAnswerWith({
        [EDITED]: { listContentIds: [LIST_ID] },
        [UNTOUCHED]: { listContentIds: [LIST_ID] },
      })
    )

    // A backend that turns every action down
    await stubProblemActions(page, 'refused')

    // Open the list
    await page.goto(`${PROBLEMS_PATH}?list=${LIST_ID}`)

    // A row to act on
    await expect(rowFor(page, EDITED)).toBeVisible({
      timeout: SETTLE_TIMEOUT_MS,
    })

    // Taken out of the list being browsed, which the app acts on before it knows whether it stuck
    await actionOn(page, EDITED, problemsCopy.addToList).click()
    await page.getByRole('dialog').getByRole('button', { name: LIST_NAME }).click()

    // It never left the list, so the list's screen still holds it
    await expect(rowFor(page, EDITED)).toBeVisible({
      timeout: SETTLE_TIMEOUT_MS,
    })

    // And the reader is told rather than left with a row that came back on its own
    await expect
      .poll(() => notices(), { timeout: SETTLE_TIMEOUT_MS })
      .toContain(problemsCopy.addToListError)
  })
})

test.describe('acting on a problem the screen has no opinion about', () => {
  test('leaves the row alone when the screen has no opinion about likes', async ({ page }) => {
    // Every reading the list takes, since a row taken away and put back is over before a check
    const readings = await recordListReadings(page)

    // Two problems, one of them liked, on a screen of the whole library
    const searches = await stubSearchAnswer(
      page,
      searchAnswerWith({ [EDITED]: { liked: true }, [UNTOUCHED]: {} })
    )

    // Every action accepted, slowly
    await stubProblemActions(page)

    // Open the library with nothing filtered on
    await page.goto(PROBLEMS_PATH)

    // The list settles a frame or two after its first row is up, the count landing last of all. A
    // baseline taken before that leaves a reading still to come, which the check below would read as
    // the click having moved the list.
    await expect
      .poll(() => readings().at(-1), { timeout: SETTLE_TIMEOUT_MS })
      .toEqual({ slugs: [EDITED, UNTOUCHED], problemCount: 2 })

    // How the list read before anything was clicked
    const readingsBeforeClick = readings().length

    // The liked problem unliked
    await actionOn(page, EDITED, problemsCopy.unlike).click()

    // Where the traffic stood when the action went out
    const searchesBeforeClick = searches()

    // The clock is the right instrument here, and the only one: this case is about a screen that
    // does nothing, so there is no event whose arrival would say the waiting is over
    await page.waitForTimeout(QUIET_MS)

    // Nothing was asked of the archive, which is what makes the quiet below meaningful rather than
    // merely early: a screen saying nothing about likes has no answer to revisit
    expect(searches()).toBe(searchesBeforeClick)

    // The screen never promised anything about likes, so the list it drew cannot have moved. Read
    // frame by frame, because a row that left and came back looks like this one either way afterwards.
    expect(readings().slice(readingsBeforeClick)).toEqual([])

    // And both rows are still there to be seen
    expect(await rowsOn(page)).toEqual([EDITED, UNTOUCHED])
  })

  test('shows a problem just marked on the screen that asks for the marked ones', async ({
    page,
  }) => {
    // Every action accepted, slowly
    const actions = await stubProblemActions(page)

    // An archive answering as the reader's marks stand: the screen of marked problems holds what
    // they have marked, which is nothing until they mark something
    await stubSearchRule(page, (query) =>
      query.markStatus === 'marked' && actions().length === 0
        ? searchAnswerWith({})
        : searchAnswerWith({ [EDITED]: { marked: actions().length > 0 } })
    )

    // Open the marked problems, which the reader has none of yet
    await page.goto(`${PROBLEMS_PATH}?markStatus=marked`)

    // So the screen says as much
    await expect(page.getByText(problemsCopy.emptyState.title)).toBeVisible({
      timeout: SETTLE_TIMEOUT_MS,
    })

    // The filter dropped, which is the library again
    await pickMarkStatus(page, filtersCopy.markStatusAll)

    // A row to act on
    await expect(rowFor(page, EDITED)).toBeVisible({
      timeout: SETTLE_TIMEOUT_MS,
    })

    // Marked from there, which is a screen saying nothing about marks
    await actionOn(page, EDITED, problemsCopy.marks.mark).click()

    // The mark reaches the archive
    await expect.poll(() => actions().length, { timeout: SETTLE_TIMEOUT_MS }).toBeGreaterThan(0)

    // The reader goes back to look at what they have marked
    await pickMarkStatus(page, filtersCopy.markStatusMarked)

    // The problem they just marked is on it, rather than the answer that screen was given before
    await expect(rowFor(page, EDITED)).toBeVisible({
      timeout: SETTLE_TIMEOUT_MS,
    })
  })

  test('leaves the whole library holding a problem unliked on the favorites screen', async ({
    page,
  }) => {
    // Every action accepted, slowly
    const actions = await stubProblemActions(page)

    // An archive answering as the reader's likes stand: their own likes lose the problem once they
    // unlike it, and the library holds it either way
    const searches = await stubSearchRule(page, (query) =>
      query.favoritesOnly
        ? searchAnswerWith(
            actions().length === 0
              ? { [EDITED]: { liked: true }, [UNTOUCHED]: { liked: true } }
              : { [UNTOUCHED]: { liked: true } }
          )
        : searchAnswerWith({
            [EDITED]: { liked: actions().length === 0 },
            [UNTOUCHED]: { liked: true },
          })
    )

    // Open the whole library, which is the answer this test is about
    await page.goto(PROBLEMS_PATH)
    await expect(rowFor(page, EDITED)).toBeVisible({
      timeout: SETTLE_TIMEOUT_MS,
    })

    // How many times the library itself has been asked for, before the reader goes anywhere
    const librarySearches = () =>
      searches().filter(
        (query) => !query.favoritesOnly && query.markStatus === null && query.listContentId === null
      ).length
    const askedBefore = librarySearches()

    // The reader looks at their own likes
    await openListsMenu(page, filtersCopy.allProblems)
    await page.getByRole('dialog').getByRole('button', { name: filtersCopy.myFavorites }).click()
    await expect(rowFor(page, EDITED)).toBeVisible({
      timeout: SETTLE_TIMEOUT_MS,
    })

    // And unlikes one from there, which takes it off that screen
    await actionOn(page, EDITED, problemsCopy.unlike).click()
    await expect(rowFor(page, EDITED)).toHaveCount(0, { timeout: 1000 })

    // Then goes back to the whole library
    await openListsMenu(page, filtersCopy.myFavorites)
    await page.getByRole('dialog').getByRole('button', { name: filtersCopy.allProblems }).click()

    // An unliked problem is still a problem, and the library was never asked to stop holding it
    await expect(rowFor(page, EDITED)).toBeVisible({
      timeout: SETTLE_TIMEOUT_MS,
    })

    // Read off what the library was answered before any of this, rather than off a fresh answer that
    // would have covered the edit up
    expect(librarySearches()).toBe(askedBefore)
  })
})

test.describe('what the screen says about a problem the reader has just edited', () => {
  test('counts a problem the reader has just liked among their own favorites', async ({ page }) => {
    // Every action accepted, slowly
    const actions = await stubProblemActions(page)

    // The reader's own lists, counted as their likes stand. Nothing but asking again can move this
    // number, since the app never counts these itself.
    await stubUserLists(page, () => ({ likedCount: actions().length, lists: [] }))

    // One problem the reader has not liked, on a screen of the whole library
    await stubSearchAnswer(page, searchAnswerWith({ [EDITED]: {} }))

    // Open the library with nothing filtered on
    await page.goto(PROBLEMS_PATH)
    await expect(rowFor(page, EDITED)).toBeVisible({
      timeout: SETTLE_TIMEOUT_MS,
    })

    // The reader has liked nothing yet, which the sidebar says
    await openListsMenu(page, filtersCopy.allProblems)
    await expect(
      page.getByRole('dialog').getByRole('button', { name: `${filtersCopy.myFavorites} 0` })
    ).toBeVisible()
    await page.keyboard.press('Escape')

    // Then likes the problem
    await actionOn(page, EDITED, problemsCopy.like).click()

    // The like reaches the archive
    await expect.poll(() => actions().length, { timeout: SETTLE_TIMEOUT_MS }).toBeGreaterThan(0)

    // So their own count of what they like has to have moved with it, rather than sit at nought
    // beside a problem drawn with a heart on it
    await openListsMenu(page, filtersCopy.allProblems)
    await expect(
      page.getByRole('dialog').getByRole('button', { name: `${filtersCopy.myFavorites} 1` })
    ).toBeVisible({ timeout: SETTLE_TIMEOUT_MS })
  })

  test('keeps the count agreeing with the rows drawn beneath it', async ({ page }) => {
    // Every reading the list takes, since a count one ahead of its rows lasts only as long as the
    // archive takes to answer and is gone before an assertion could look
    const readings = await recordListReadings(page)

    // Every action accepted, slowly
    const actions = await stubProblemActions(page)

    // An archive answering as the reader's likes stand
    const searches = await stubSearchRule(page, () =>
      searchAnswerWith(
        actions().length === 0
          ? { [EDITED]: { liked: true }, [UNTOUCHED]: { liked: true } }
          : { [UNTOUCHED]: { liked: true } }
      )
    )

    // Open the reader's likes
    await page.goto(`${PROBLEMS_PATH}?favoritesOnly=true`)
    await expect(rowFor(page, EDITED)).toBeVisible({
      timeout: SETTLE_TIMEOUT_MS,
    })

    // However many readings the list took finding its feet. The rows are virtualized, so the first
    // paint draws one row to measure it by and fills the viewport a frame later, and a count standing
    // beside that one row is the list working out its own height rather than the screen disagreeing.
    const readingsWhileSettling = readings().length

    // One of them unliked, which takes the row off the screen at once
    await actionOn(page, EDITED, problemsCopy.unlike).click()

    // Wait on the search the action sets off rather than on the clock: on a slow box the clock runs
    // out before the refetch lands, and the log then holds only frames from before the click, which
    // agree with each other and prove nothing
    await expect.poll(() => searches().length, { timeout: SETTLE_TIMEOUT_MS }).toBeGreaterThan(1)

    // Then a short settle, for the render the answer causes
    await page.waitForTimeout(QUIET_MS)

    // Every reading taken since the list settled
    const settled = readings().slice(readingsWhileSettling)

    // Not one of them said a number the rows under it did not add up to. A screen searching again
    // says no number at all, which is the one honest way to say nothing.
    const disagreeing = settled.filter(
      (reading) => reading.problemCount !== null && reading.problemCount !== reading.slugs.length
    )
    expect(disagreeing).toEqual([])

    // And a number was said at some point, since a screen that never draws one satisfies the check
    // above without ever having been asked the question
    expect(settled.some((reading) => reading.problemCount !== null)).toBe(true)
  })
})
