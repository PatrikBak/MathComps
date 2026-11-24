import type { Page, Route } from '@playwright/test'

import {
  PROBLEM_CARD_ATTRIBUTE,
  PROBLEM_COUNT_ATTRIBUTE,
} from '@/components/features/problems/constants/problem-list-attributes'
import type { FilterQuery, Problem } from '@/components/features/problems/types/problem-api-types'
import type {
  FilterOptionsWithCounts,
  FilterResult,
  SingleProblemResponse,
} from '@/components/features/problems/types/problem-library-types'

import searchFixture from '../fixtures/problem-filter-response.json'
import { BACKEND_ORIGIN, refuse, SEARCH_PATH } from './backend-routes'

/**
 * How a problem served here differs from the one the fixture carries.
 */
export type ProblemTraits = {
  /** Whether the reader has liked it. */
  liked?: boolean
  /** Whether the reader has marked it. */
  marked?: boolean
  /** The reader's lists holding it, by content id. */
  listContentIds?: string[]
  /** Its solution as Markdown, null for a problem with none. */
  solutionMarkdown?: string | null
  /** Its tags. */
  tags?: Problem['tags']
}

/**
 * One problem as the archive serves it, a copy of the one the fixture carries under another slug.
 *
 * @param slug - The slug it is given.
 * @param traits - How it differs from the fixture's problem.
 *
 * @returns The problem, as the archive puts it on the wire.
 */
function problemFromFixture(slug: string, traits: ProblemTraits): Problem {
  // The one problem the fixture carries, safe to edit
  const [template] = structuredClone(searchFixture).filterResult.problems
    .items as unknown as Problem[]

  // A fixture with no problem in it leaves nothing to copy
  if (template === undefined) throw new Error('The search fixture carries no problem')

  // The copy, carrying none of the reader's own state and no solution unless the traits give it one
  return {
    ...template,
    slug,
    liked: false,
    marked: false,
    listContentIds: [],
    solutionMarkdown: null,
    ...traits,
  }
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
 * Only the {@link ProblemTraits} of each problem are varied. Everything else, the statements, the counts,
 * the options the sidebar draws, is the fixture's, so a page built from this renders exactly as the
 * archive's own answer does.
 *
 * @param problemTraits - How each problem answered with differs from the fixture's, keyed by the slug
 *   it is given.
 * @param totalCount - How many the narrowing matches in all, defaulting to the ones served here.
 *   Anything above that is what tells the library another page is waiting behind this one.
 *
 * @returns The answer, as the search endpoint puts it on the wire.
 */
export function searchAnswerWith(
  problemTraits: Record<string, ProblemTraits>,
  totalCount?: number
): unknown {
  // The answer as it came back from the archive, safe to edit
  const answer = structuredClone(searchFixture)

  // One problem per slug asked for, each carrying the traits that slug is given
  const items = Object.entries(problemTraits).map(([slug, traits]) =>
    problemFromFixture(slug, traits)
  )

  // The page they make up, which the library reads its rows and its total off
  answer.filterResult.problems = {
    ...answer.filterResult.problems,
    items,
    totalCount: totalCount ?? items.length,
  } as typeof answer.filterResult.problems

  // The answer, now about these problems
  return answer
}

/**
 * Builds a search answer holding a full page of problems, with as many again waiting behind it.
 *
 * A list can only be scrolled to its end once it has enough rows to scroll, and it only asks for the
 * next page once the count says one exists. Both are what this is for, and neither is true of a single
 * problem, which is all the fixture carries on its own.
 *
 * @returns The answer, as the search endpoint puts it on the wire.
 */
export function searchAnswerWithMoreToCome(): unknown {
  // A page as full as the archive itself serves them
  const { pageSize } = searchFixture.filterResult.problems

  // The problems filling it, there to fill the page rather than to be read
  const rows = Object.fromEntries(
    Array.from({ length: pageSize }, (_unused, index) => [`filler-problem-${index + 1}`, {}])
  )

  // Twice the page, so the first one leaves another behind it
  return searchAnswerWith(rows, pageSize * 2)
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

  // Stand in for the search alone
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
 * A test for whether a request reads one problem by its slug, its query string aside, in any case the
 * slug is asked in, as the archive reads it.
 *
 * @param slug - The problem's slug.
 *
 * @returns The test a request's address is put to.
 */
function isReadOf(slug: string): (url: URL) => boolean {
  // Where the problem is read from
  const readUrl = `${BACKEND_ORIGIN}/problems/${encodeURIComponent(slug)}`.toLowerCase()

  // That address, whatever its case
  return (url) => `${url.origin}${url.pathname}`.toLowerCase() === readUrl
}

/**
 * Stands in for the endpoint one problem is read from by its slug, answering with a copy of the
 * fixture's problem under that slug.
 *
 * @param page - The page to intercept the read on.
 * @param slug - The slug of the problem the endpoint answers for.
 * @param traits - How that problem differs from the fixture's problem.
 */
export async function stubSingleProblem(
  page: Page,
  slug: string,
  traits: ProblemTraits
): Promise<void> {
  // The page holding the one problem, with the options the fixture carries
  const filterResult: FilterResult = {
    problems: { items: [problemFromFixture(slug, traits)], page: 1, pageSize: 1, totalCount: 1 },
    baseOptions: searchFixture.filterResult.baseOptions as unknown as FilterOptionsWithCounts,
    updatedOptions: searchFixture.filterResult.updatedOptions as unknown as FilterOptionsWithCounts,
  }

  // The answer, placing the problem where the fixture's own problem sits
  const answer: SingleProblemResponse = {
    filterResult,
    filters: { season: 67, competitionPath: 'tst-d3', problemNumber: 1 },
  }

  // Stand in for that read alone
  await page.route(isReadOf(slug), (route) =>
    route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(answer) })
  )
}

/**
 * Stands in for the endpoint one problem is read from by its slug, answering the way the archive
 * answers a slug no problem goes by.
 *
 * @param page - The page to intercept the read on.
 * @param slug - The slug no problem goes by.
 */
export async function stubMissingProblem(page: Page, slug: string): Promise<void> {
  // Refuse that read, naming the problem as missing
  await page.route(isReadOf(slug), (route) => refuse(route, 404, 'ProblemNotFound'))
}

/**
 * Breaks the endpoint one problem is read from by its slug, the server failing every read, until the
 * returned function mends it and the reads go on to whatever stands in for the endpoint underneath.
 *
 * @param page - The page to intercept the read on.
 * @param slug - The slug whose read fails.
 *
 * @returns A function which mends the read.
 */
export async function breakProblemRead(page: Page, slug: string): Promise<() => void> {
  // Whether the read still fails
  let isBroken = true

  // Fail that read while it is broken, and hand it on once mended
  await page.route(isReadOf(slug), (route) =>
    isBroken ? refuse(route, 503, undefined) : route.fallback()
  )

  // A function which mends the read
  return () => {
    isBroken = false
  }
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
 * The names of the attributes a reading of the list is taken from, handed into the page, since a script
 * running there cannot see the test's own imports.
 */
type ListAttributeNames = {
  /** The attribute each problem's card carries its slug under. */
  card: string
  /** The attribute the bar carries how many problems the search matched under. */
  count: string
}

/** The names of the card and count attributes, as the app declares them. */
const LIST_ATTRIBUTE_NAMES: ListAttributeNames = {
  card: PROBLEM_CARD_ATTRIBUTE.name,
  count: PROBLEM_COUNT_ATTRIBUTE.name,
}

/**
 * Reads the list of problems on every frame the browser paints, handing over each reading that
 * differs from the one before it.
 *
 * Written to be installed twice over a page's life, so it refuses to watch a document it is already
 * watching: two watchers would hand the same reading over twice, and each would then read as a row
 * that went and came back.
 */
function watchList({ card, count }: ListAttributeNames): void {
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
    const slugs = [...document.querySelectorAll(`[${card}]`)].map(
      (row) => row.getAttribute(card) ?? ''
    )

    // What the screen says the search matches, which a search in flight takes off the screen
    const counted = document.querySelector(`[${count}]`)?.getAttribute(count)

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
  await page.addInitScript(watchList, LIST_ATTRIBUTE_NAMES)

  // And the document already open, so that calling this after a page has loaded records that page
  await page.evaluate(watchList, LIST_ATTRIBUTE_NAMES)

  // Hand back a snapshot on each read, so a list cannot grow underneath an assertion mid-check
  return () => [...readings]
}
