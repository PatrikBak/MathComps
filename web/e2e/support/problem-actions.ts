import type { Page, Route } from '@playwright/test'

import type { FilterQuery, Problem } from '@/components/features/problems/types/problem-api-types'
import type { UserListsResponse } from '@/components/features/problems/types/user-list-types'

import searchFixture from '../fixtures/problem-filter-response.json'
import { BACKEND_ORIGIN, SEARCH_PATH } from './backend-routes'

/**
 * The reader's own state on a problem, which is what every action here moves.
 */
export type ProblemReaderState = {
  /** Whether the reader has liked it. */
  liked?: boolean
  /** Whether the reader has marked it. */
  marked?: boolean
  /** The reader's lists holding it, by content id. */
  listContentIds?: string[]
}

/**
 * How long the archive is made to think about an action before answering it.
 *
 * An action answered the instant it is asked leaves no window in which the row is gone on the app's
 * say-so alone, which is the whole of what these tests are about: the answer would arrive, the search
 * would be invalidated, and a row missing afterwards could be either the app or the server talking.
 */
export const ACTION_DELAY_MS = 1500

/**
 * Builds a search answer carrying the given problems, out of one the archive really gave.
 *
 * Only the reader's own state on each problem is varied. Everything else, the statements, the counts,
 * the options the sidebar draws, is the fixture's, so a page built from this renders exactly as the
 * archive's own answer does.
 *
 * @param readerStates - The problems to answer with, keyed by the slug each is given.
 *
 * @returns The answer, as the search endpoint puts it on the wire.
 */
export function searchAnswerWith(readerStates: Record<string, ProblemReaderState>): unknown {
  // The answer as it came back from the archive, safe to edit
  const answer = structuredClone(searchFixture)

  // The one problem the fixture carries, which every problem below is a copy of
  const [template] = answer.filterResult.problems.items as unknown as Problem[]

  // One problem per slug asked for, each carrying the reader's state that slug is given
  const items = Object.entries(readerStates).map(([slug, state]) => ({
    ...template,
    slug,
    liked: false,
    marked: false,
    listContentIds: [],
    ...state,
  }))

  // The page they make up, which the library reads its rows and its total off
  answer.filterResult.problems = {
    ...answer.filterResult.problems,
    items,
    totalCount: items.length,
  } as typeof answer.filterResult.problems

  // The answer, now about these problems
  return answer
}

/**
 * Stands in for the search endpoint, answering each search as the rule standing in here decides.
 *
 * @param page - The page to intercept searches on.
 * @param answerFor - What a search earns, built per {@link searchAnswerWith}.
 *
 * @returns Every search that was sent, as the query it carried.
 */
export async function stubSearchRule(
  page: Page,
  answerFor: (query: FilterQuery) => unknown
): Promise<() => FilterQuery[]> {
  // Every search that reached the endpoint, in the order it was sent
  const searches: FilterQuery[] = []

  // Stand in for the search alone, leaving everything else to the real backend
  await page.route(`${BACKEND_ORIGIN}${SEARCH_PATH}`, async (route) => {
    // The search as it went out
    const query = route.request().postDataJSON() as FilterQuery

    // Recorded before it is answered, so a test watching traffic sees it as it happens
    searches.push(query)

    // Answered as the rule says
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(answerFor(query)),
    })
  })

  // Hand back a snapshot on each read, so a list cannot grow underneath an assertion mid-check
  return () => [...searches]
}

/**
 * Stands in for the search endpoint, answering every search with the same page of problems.
 *
 * @param page - The page to intercept searches on.
 * @param answer - The answer to give, per {@link searchAnswerWith}.
 *
 * @returns How many searches have been sent so far.
 */
export async function stubSearchAnswer(page: Page, answer: unknown): Promise<() => number> {
  // The same page of problems whatever the search asked for
  const searches = await stubSearchRule(page, () => answer)

  // How many were sent, which is all this one's callers read of them
  return () => searches().length
}

/**
 * What an action the reader takes on a problem earns from the backend standing in here.
 */
export type ActionOutcome = 'accepted' | 'refused'

/**
 * Stands in for the endpoints a reader's own actions on a problem go to: the like, the mark, and a
 * list's membership.
 *
 * Each answers slowly on purpose, per {@link ACTION_DELAY_MS}, so a test can look at the screen while
 * the request is still in flight and see what the app did on its own account.
 *
 * @param page - The page to intercept the actions on.
 * @param outcome - What every action earns, refused standing in for a backend that turns it down.
 *
 * @returns Every action that reached an endpoint, as the URL it was sent to.
 */
export async function stubProblemActions(
  page: Page,
  outcome: ActionOutcome = 'accepted'
): Promise<() => string[]> {
  // Every action that was taken, in the order it was sent
  const actions: string[] = []

  /**
   * Records an action and answers it as the outcome asks.
   *
   * @param route - The request to answer.
   */
  const answer = async (route: Route) => {
    // Record it before it is answered, so a test watching traffic sees it as it happens
    actions.push(route.request().url())

    // Think about it, which is what leaves the optimistic window open
    await new Promise((resolve) => setTimeout(resolve, ACTION_DELAY_MS))

    // A refusal is answered as the backend writes a failure, which is the whole of what the app reads
    if (outcome === 'refused') {
      await route.fulfill({
        status: 500,
        contentType: 'application/problem+json',
        body: JSON.stringify({ status: 500, errorCode: 'InternalServerError' }),
      })

      return
    }

    // Accepted, which these endpoints say with a body of nothing
    await route.fulfill({ status: 204 })
  }

  // The like and the mark, both hanging off the problem itself
  await page.route(`${BACKEND_ORIGIN}/problems/*/like`, answer)
  await page.route(`${BACKEND_ORIGIN}/problems/*/mark`, answer)

  // A problem's place in one of the reader's lists
  await page.route(`${BACKEND_ORIGIN}/users/me/lists/*/problems/*`, answer)

  // Hand back a snapshot on each read, so a list cannot grow underneath an assertion mid-check
  return () => [...actions]
}

/**
 * Stands in for the endpoint the reader's own lists are drawn from, answering it afresh each time it
 * is asked.
 *
 * The counts are read at the moment of the answer rather than fixed when the stub is installed, so a
 * number that moves on screen proves the archive was asked again. Nothing else can move it: the app
 * never counts these itself.
 *
 * @param page - The page to intercept the lookup on.
 * @param listsNow - The lists and the liked count as they stand when the lookup arrives.
 *
 * @returns How many times the lists have been asked for so far.
 */
export async function stubUserLists(
  page: Page,
  listsNow: () => UserListsResponse
): Promise<() => number> {
  // Every lookup that reached the endpoint
  let lookups = 0

  // Stand in for the lists alone, leaving the endpoints under them to the action stub
  await page.route(`${BACKEND_ORIGIN}/users/me/lists`, async (route) => {
    // The lists were asked for, whatever becomes of it
    lookups++

    // Answered as they stand right now
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(listsNow()),
    })
  })

  // Hand back a reader rather than the counter itself, so the caller always sees the live value
  return () => lookups
}

/**
 * The list of problems as one frame painted it.
 */
export type ListReading = {
  /** The problems drawn, in the order the list draws them. */
  slugs: string[]
  /** How many problems the screen says the search matches, absent while it is being searched again. */
  problemCount: number | null
}

declare global {
  interface Window {
    /** Hands one reading of the list over to the test run. */
    reportListReading: (reading: ListReading) => void
    /** Whether this document's list is already being read. */
    isWatchingList?: boolean
  }
}

/**
 * Reads the list of problems on every frame the browser paints, handing over each reading that
 * differs from the one before it.
 *
 * Written to be installed twice over a page's life, so it refuses to watch a document it is already
 * watching: two watchers would hand the same reading over twice, and each would then read as a row
 * that went and came back.
 */
function watchList(): void {
  // This document is already accounted for
  if (window.isWatchingList) return

  // From here it is being watched
  window.isWatchingList = true

  // The reading handed over last, which is what makes the next one worth handing over
  let previous = ''

  // Whether the list has ever drawn a row. Before it has, an empty screen is one still loading; after
  // it has, an empty screen is the list losing every row it had, which is the loudest thing it can do
  // and so the last thing to go unreported.
  let hasDrawn = false

  // A function which reads the list as it stands and hands over anything that has moved
  const readList = () => {
    // Every problem on screen, in the order the list draws them
    const slugs = [...document.querySelectorAll('[data-problem-slug]')].map(
      (row) => row.getAttribute('data-problem-slug') ?? ''
    )

    // What the screen says the search matches, which a search in flight takes off the screen
    const counted = document
      .querySelector('[data-problem-count]')
      ?.getAttribute('data-problem-count')

    // The list as this frame drew it
    const reading: ListReading = {
      slugs,
      problemCount: counted === undefined || counted === null ? null : Number(counted),
    }

    // A row on screen is the list having drawn, and it never un-draws
    if (slugs.length > 0) hasDrawn = true

    // The reading as one string, which is how it is told apart from the one before it
    const asText = JSON.stringify(reading)

    // A list that has yet to draw anything is still loading, which is no reading rather than a
    // reading of none
    if (hasDrawn && asText !== previous) {
      // Hand it over, once
      previous = asText
      window.reportListReading(reading)
    }

    // Read it again on the next frame, since a reading nobody painted is one nobody could see
    requestAnimationFrame(readList)
  }

  // Take the first reading now, rather than a frame into the future
  readList()
}

/**
 * Records every reading the list takes, for as long as the test runs.
 *
 * A row taken off the screen and put back is over before an assertion could look, and so is a count
 * that disagreed with the rows beneath it for as long as the archive took to answer. A test asking
 * whether either ever happened has to watch rather than check, and frame by frame is the whole of
 * what such a question can be held to.
 *
 * @param page - The page to watch.
 *
 * @returns Every reading taken so far, oldest first.
 */
export async function recordListReadings(page: Page): Promise<() => ListReading[]> {
  // Every reading the list took, in the order it took them
  const readings: ListReading[] = []

  // The channel the page hands each reading back through
  await page.exposeFunction('reportListReading', (reading: ListReading) => {
    readings.push(reading)
  })

  // Every document from the next one on, since the rows are drawn long before a test can look
  await page.addInitScript(watchList)

  // And the document already open, so that calling this after a page has loaded records that page
  await page.evaluate(watchList)

  // Hand back a snapshot on each read, so a list cannot grow underneath an assertion mid-check
  return () => [...readings]
}
