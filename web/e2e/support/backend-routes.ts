import type { Page } from '@playwright/test'

import type { CommentDto } from '@/components/features/comments/services/comment-api-types'
import type { FilterQuery } from '@/components/features/problems/types/problem-api-types'
import type { UserListsResponse } from '@/components/features/problems/types/user-list-types'
import type { UserProfile } from '@/components/features/profile/model/profile-types'
import { ROUTES } from '@/i18n/i18n'
import type { AppErrorCode } from '@/lib/api/api-error-codes'

import searchFixture from '../fixtures/problem-filter-response.json'

/**
 * The problems page in English, which is the canonical locale and so carries no route translation.
 * The locale is fixed here because it picks the messages the assertions match on.
 */
export const PROBLEMS_PATH = `/en${ROUTES.PROBLEMS}`

/**
 * Where the backend listens, read from the same variable the app builds its request URLs from. A
 * hardcoded origin that drifted would stop intercepting silently, and the page would then fail for
 * reasons that look nothing like a stale constant.
 */
export const BACKEND_ORIGIN = (() => {
  // Whatever the environment holds under the name the app itself reads
  const apiUrl = process.env.NEXT_PUBLIC_API_URL

  // The app cannot make a single call without it, so there would be nothing to intercept
  if (apiUrl === undefined || apiUrl.trim() === '') {
    throw new Error('Missing NEXT_PUBLIC_API_URL. It belongs in web/.env.')
  }

  // Trim the trailing slash so the route globs below have exactly one separator
  return apiUrl.replace(/\/$/, '')
})()

/** Where the library asks for a page of problems. */
export const SEARCH_PATH = '/problems/filter'

/**
 * The refusals a search can earn, each against the status the backend answers it with.
 *
 * These are the codes an ownership question resolves to, so a stub choosing between them is standing
 * in for the whole of the rule: whether this reader may have this list, these favorites, these marks.
 */
const REFUSAL_STATUSES = {
  ListNotFound: 404,
  ListAccessDenied: 403,
  FavoritesRequireAuthentication: 401,
  MarkStatusRequiresAuthentication: 401,
} as const satisfies Partial<Record<AppErrorCode, number>>

/** A refusal the search endpoint can answer with. */
export type SearchRefusal = keyof typeof REFUSAL_STATUSES

/**
 * One search the library sent, as the ownership rule sees it.
 */
export type SearchCall = {
  /** The search as the library asked for it. */
  query: FilterQuery
  /** Whether a reader rode along with it, which is the only thing that can make a filter theirs. */
  isAuthenticated: boolean
}

/**
 * Counts the calls the app makes to the backend and answers every one of them as unreachable.
 *
 * Standing in for the API here rather than stopping the real one keeps these tests deterministic,
 * and lets a single test watch traffic stop and start. Clerk's own traffic is left alone, since the
 * page never gets as far as querying without it.
 *
 * @param page - The page to intercept requests on.
 *
 * @returns How many backend calls have been attempted so far.
 */
export async function failEveryBackendCall(page: Page): Promise<() => number> {
  // Every attempt counts, including the ones React Query makes on its own
  let attempts = 0

  // Stand in for the whole backend
  await page.route(`${BACKEND_ORIGIN}/**`, async (route) => {
    // The call was made, whatever becomes of it
    attempts++

    // An aborted connection is what a stopped API looks like from the browser: no response, no status
    await route.abort('connectionrefused')
  })

  // Hand back a reader rather than the counter itself, so the caller always sees the live value
  return () => attempts
}

/**
 * Counts the calls the app makes to the backend and has the server refuse every one of them.
 *
 * A refusal is the opposite of an outage: the server answered, so repeating the request cannot help.
 *
 * @param page - The page to intercept requests on.
 * @param status - The client-error status to answer with.
 *
 * @returns How many backend calls have been attempted so far.
 */
export async function refuseEveryBackendCall(page: Page, status: number): Promise<() => number> {
  // Every attempt counts, including the ones React Query makes on its own
  let attempts = 0

  // Stand in for the whole backend
  await page.route(`${BACKEND_ORIGIN}/**`, async (route) => {
    // The call was made, whatever becomes of it
    attempts++

    // A bodyless client error is what a rate limiter or an authorization check looks like here
    await route.fulfill({ status })
  })

  // Hand back a reader rather than the counter itself, so the caller always sees the live value
  return () => attempts
}

/**
 * Stands in for the ownership rule on the search endpoint, recording every search that reaches it.
 *
 * None of the library's narrowings are database facts, they are answers: a list is one this reader
 * may open or may not, favorites are theirs or nobody's. The token on the request is the whole of
 * what decides that, so a handler reading it and the body beside it can be the rule, with no rows
 * behind it.
 *
 * A refusal is answered with the status and the code, which is the whole of what the client reads
 * off a failed request.
 *
 * @param page - The page to intercept searches on.
 * @param refuse - Decides what a search earns, answering null to let the archive answer it.
 *
 * @returns The searches sent so far, oldest first.
 */
export async function stubProblemSearch(
  page: Page,
  refuse: (call: SearchCall) => SearchRefusal | null
): Promise<() => SearchCall[]> {
  // Every search that reached the endpoint, in the order it was sent
  const calls: SearchCall[] = []

  // Stand in for the search alone
  await page.route(`${BACKEND_ORIGIN}${SEARCH_PATH}`, async (route) => {
    // The search as it went out, and whether a reader rode along with it
    const call: SearchCall = {
      query: route.request().postDataJSON() as FilterQuery,
      isAuthenticated: route.request().headers().authorization !== undefined,
    }

    // Record it before it is answered, so a test watching traffic sees it as it happens
    calls.push(call)

    // What this search earns from the rule standing in here
    const refusal = refuse(call)

    // Nothing refused it, so it gets an answer the archive itself once gave
    if (refusal === null) {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(searchFixture),
      })

      return
    }

    // Refused, in the shape the backend writes a business failure as
    await route.fulfill({
      status: REFUSAL_STATUSES[refusal],
      contentType: 'application/problem+json',
      body: JSON.stringify({ status: REFUSAL_STATUSES[refusal], errorCode: refusal }),
    })
  })

  // Hand back a snapshot on each read, so a list cannot grow underneath an assertion mid-check
  return () => [...calls]
}

declare global {
  interface Window {
    /** Hands a notice's text to the test run as the notice reaches the screen. */
    reportNotice: (text: string) => void
    /** Whether this document is already being watched for notices. */
    isWatchingNotices?: boolean
  }
}

/**
 * Watches a document for notices and hands each one over as it becomes readable.
 *
 * Written to be installed twice over a page's life, once into the document that is already open and
 * once ahead of every document after it, so it refuses to watch a document it is already watching:
 * two watchers would hand the same notice over twice, and a test counting them would read that as
 * the app having said it twice.
 */
function watchForNotices(): void {
  // This document is already accounted for
  if (window.isWatchingNotices) return

  // From here it is being watched
  window.isWatchingNotices = true

  // The notices already handed over, held by node so that two saying the same thing both count
  const reported = new WeakSet<Element>()

  // A function which hands over every notice on screen that has not been handed over yet
  const reportNewNotices = () => {
    document.querySelectorAll('[data-sonner-toast]').forEach((notice) => {
      // Already accounted for
      if (reported.has(notice)) return

      // The message itself, which the notice's own actions sit beside rather than inside
      const message = notice.querySelector('[data-title]')?.textContent?.trim() ?? ''

      // The node is on screen a moment before its text is, so it is worth another mutation
      if (message === '') return

      // Hand it over, once
      reported.add(notice)
      window.reportNotice(message)
    })
  }

  // The document itself is what there is to watch: installed ahead of a page, this runs before that
  // page has been parsed, so its root element does not exist yet. Text arriving counts as much as a
  // node arriving, since a notice is only readable once it has both.
  new MutationObserver(reportNewNotices).observe(document, {
    childList: true,
    subtree: true,
    characterData: true,
  })
}

/**
 * Records every notice the page raises, for as long as the test runs.
 *
 * A notice takes itself back down after a few seconds, so looking for one at a chosen moment cannot
 * tell one that was never raised from one that has already expired: the check passes either way, and
 * an assertion that a reader was NOT told something is exactly the kind that then proves nothing.
 * Watching for them as they arrive answers whether, and how many times, rather than whether now.
 *
 * @param page - The page to watch.
 *
 * @returns Every notice raised so far, oldest first, repeats included.
 */
export async function recordNotices(page: Page): Promise<() => string[]> {
  // Every notice that reached the screen, in the order it got there
  const notices: string[] = []

  // The channel the page hands each notice back through
  await page.exposeFunction('reportNotice', (text: string) => {
    notices.push(text)
  })

  // Every document from the next one on, since the first notice of a page can be up and gone before
  // the first assertion of a test is reached
  await page.addInitScript(watchForNotices)

  // And the document already open, so that calling this after a page has loaded records that page
  // rather than silently nothing, which no assertion of the kind this exists for could survive
  await page.evaluate(watchForNotices)

  // Hand back a snapshot on each read, so a list cannot grow underneath an assertion mid-check
  return () => [...notices]
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

  // Stand in for the lists alone
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

/** A problem nobody has said anything about. */
const NO_COMMENTS: CommentDto[] = []

/** A reader who keeps no lists and has liked nothing, which is what a spec about neither wants. */
const NO_LISTS: UserListsResponse = { likedCount: 0, lists: [] }

/**
 * A reader who has said nothing about themselves yet.
 *
 * Blank rather than complete because a spec here decides what its reader has filled in through its own
 * stub, and specs about a student who has filled in nothing would otherwise have the app holding two
 * answers to the same question.
 */
const NOTHING_SAID: UserProfile = {
  graduationYear: null,
  hasLeftHighSchool: false,
  countryCode: null,
  email: null,
  username: null,
}

/**
 * Answers one read a page makes about whoever is looking at it, and only the read.
 *
 * A write on the same path is something a spec is doing on purpose, so it is passed on to the refusal
 * underneath and named there.
 *
 * @param page - The page to intercept the read on.
 * @param pattern - Which URLs it answers, as a Playwright route glob.
 * @param body - What it answers with.
 */
async function stubAmbientRead(page: Page, pattern: string, body: unknown): Promise<void> {
  // Stand in for that one endpoint
  await page.route(pattern, async (route) => {
    // Anything but a read belongs to whichever spec is making it
    if (route.request().method() !== 'GET') {
      await route.fallback()
      return
    }

    // Answered as it stands
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(body),
    })
  })
}

/**
 * Answers the reads a page makes about whoever is looking at it, none of which any spec here is about.
 *
 * A problem row asks for its discussion, the library sidebar asks for the reader's lists, and the
 * header asks what the site holds on them. A spec that leaves those to whatever the author has running
 * locally passes on that machine and nowhere else, so they are answered here with the emptiest thing
 * that renders. A spec these are the subject of registers its own stub afterwards, which is the one
 * Playwright then tries first.
 *
 * @param page - The page to intercept the reads on.
 */
export async function stubReaderAndDiscussion(page: Page): Promise<void> {
  // The discussion under a problem, which every row on screen asks for
  await stubAmbientRead(page, `${BACKEND_ORIGIN}/comments*`, NO_COMMENTS)

  // The reader's own lists
  await stubAmbientRead(page, `${BACKEND_ORIGIN}/users/me/lists`, NO_LISTS)

  // What the site holds on them
  await stubAmbientRead(page, `${BACKEND_ORIGIN}/users/me/profile`, NOTHING_SAID)
}
