import type { Page, Request, Route } from '@playwright/test'

import type { CommentDto } from '@/components/features/comments/services/comment-api-types'
import type {
  DefenseCopy,
  DefenseSessionListItem,
} from '@/components/features/defense/model/defense-types'
import type { Organization } from '@/components/features/problem-selection/model/selection-types'
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

/** The shape of an id the backend's routes take, any other answering as a path it does not serve. */
export const GUID = '[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}'

/**
 * Whether a value read off a request body is an id the backend can bind.
 *
 * @param value - The value.
 *
 * @returns True for a string shaped like an id.
 */
export function isGuid(value: unknown): value is string {
  // A string, and nothing but an id
  return typeof value === 'string' && new RegExp(`^${GUID}$`).test(value)
}

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
 * Answers a call with a JSON body.
 *
 * @param route - The call.
 * @param status - The status it is answered with.
 * @param body - What it is answered with.
 */
export function answerJson(route: Route, status: number, body: unknown): Promise<void> {
  // The body, as the backend writes one
  return route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) })
}

/**
 * A call the backend turns away.
 */
export type Refusal = {
  /** The status it is refused with. */
  status: number
  /** The code saying why, or undefined for a failure that names none. */
  errorCode: AppErrorCode | undefined
}

/**
 * Refuses a call, as a problem document when a code says why, or with an empty body where nothing does.
 *
 * @param route - The call.
 * @param status - The status it is refused with.
 * @param errorCode - The code saying why, or undefined for a failure that names none, which comes with no body.
 */
export function refuse(
  route: Route,
  status: number,
  errorCode: AppErrorCode | undefined
): Promise<void> {
  // A failure naming no code, with nothing to say
  if (errorCode === undefined) return route.fulfill({ status, body: '' })

  // The status and the code, as a problem document
  return route.fulfill({
    status,
    contentType: 'application/problem+json',
    body: JSON.stringify({ status, errorCode }),
  })
}

/** Where the store serves uploaded files from. */
const STORE_ORIGIN = 'https://store.example.test'

/** The smallest image a browser draws, one transparent pixel. */
export const ONE_PIXEL_PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==',
  'base64'
)

/**
 * The link the backend hands out to an uploaded file.
 *
 * @param key - The file's upload key.
 *
 * @returns The link, as the store would serve the file at it.
 */
export function fileLinkTo(key: string): string {
  // The file's place in the store, signed
  return `${STORE_ORIGIN}/user-uploads/user_${key}?X-Amz-Signature=fake`
}

/**
 * Serves every file in the store as one small image, so an uploaded image on the page loads the way it does from
 * the real store. A spec whose subject is the file itself registers its own route afterwards, which Playwright then
 * tries first.
 *
 * @param page - The page to serve the files on.
 */
export async function serveStoredFiles(page: Page): Promise<void> {
  // Whatever file is asked for, answered with the one image
  await page.route(`${STORE_ORIGIN}/**`, (route) =>
    route.fulfill({ status: 200, contentType: 'image/png', body: ONE_PIXEL_PNG })
  )
}

/**
 * Counts the calls the app makes to the backend and answers every one of them as unreachable.
 *
 * The count lets a single test watch the app's traffic stop and start again. Clerk's own traffic is
 * left alone, since the page never gets as far as querying without it.
 *
 * @param page - The page to intercept requests on.
 *
 * @returns How many backend calls have been attempted so far.
 */
export async function failEveryBackendCall(page: Page): Promise<() => number> {
  // Every backend call attempted so far, retries included
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
 * Counts the calls the app makes to the backend and refuses every one of them with a client error.
 *
 * A refusal is the opposite of an outage: the server answered, so repeating the request cannot help.
 *
 * @param page - The page to intercept requests on.
 * @param status - The client-error status to answer with.
 *
 * @returns How many backend calls have been attempted so far.
 */
export async function refuseEveryBackendCall(page: Page, status: number): Promise<() => number> {
  // Every backend call attempted so far, retries included
  let attempts = 0

  // Stand in for the whole backend
  await page.route(`${BACKEND_ORIGIN}/**`, async (route) => {
    // The call was made, whatever becomes of it
    attempts++

    // A client error with no body, so only its status says the call was refused
    await route.fulfill({ status })
  })

  // Hand back a reader rather than the counter itself, so the caller always sees the live value
  return () => attempts
}

/**
 * Stands in for the ownership rule on the search endpoint, recording every search that reaches it.
 *
 * The test hands in the rule as a function of the search and whether a reader rode along with it, so
 * a refusal needs no list, favorite or mark to exist behind it.
 *
 * A refusal is answered with the status and the code, which is the whole of what the client reads
 * off a failed request.
 *
 * @param page - The page to intercept searches on.
 * @param refuse - Decides what a search earns, null serving the fixture's page of problems.
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

    // Record the search before it is answered, so a test watching traffic sees it as it happens
    calls.push(call)

    // What this search earns from the rule standing in here
    const refusal = refuse(call)

    // Nothing refused the search
    if (refusal === null) {
      // An answer the archive itself once gave
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(searchFixture),
      })

      // Answered, so no refusal follows
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

/** A discussion nobody has said anything in. */
const NO_COMMENTS: CommentDto[] = []

/** A reader who keeps no lists and has liked nothing, which is what a spec about neither wants. */
const NO_LISTS: UserListsResponse = { likedCount: 0, lists: [] }

/**
 * A reader who has said nothing about themselves yet.
 *
 * Blank rather than complete because a spec decides what its reader has filled in through its own
 * stubs, and a complete profile here would contradict a competition spec whose entry readiness says
 * the student has filled in nothing.
 */
const NOTHING_SAID: UserProfile = {
  graduationYear: null,
  hasLeftHighSchool: false,
  countryCode: null,
  email: null,
  username: null,
}

/** A reader on no organization's list, which is every reader a spec doesn't say otherwise of. */
const NO_ORGANIZATIONS: Organization[] = []

/** A reader who has held no conversation with the examiner. */
const NO_CONVERSATIONS: DefenseSessionListItem[] = []

/** The greeting the chat opens on, standing in for whatever the backend currently greets with. */
export const MATHILDA_OPENER: DefenseCopy = { opener: 'Tell me how you got there.' }

/**
 * Answers one read a page makes on its own account, and only the read.
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
      // Passed to the refusal underneath, which names it
      await route.fallback()

      // Nothing more for this stub to do with it
      return
    }

    // Answered with the body it was given
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(body),
    })
  })
}

/**
 * Stands in for the endpoint the reader's organizations are read from.
 *
 * @param page - The page to intercept the read on.
 * @param organizations - What it answers with.
 *
 * @returns How many times the organizations have been asked for so far.
 */
export async function stubOwnOrganizations(
  page: Page,
  organizations: Organization[]
): Promise<() => number> {
  // Every lookup that reached the endpoint
  let lookups = 0

  // Answered with the organizations given, over the ambient answer of none
  await page.route(`${BACKEND_ORIGIN}/users/me/organizations`, async (route) => {
    // The organizations were asked for, whatever becomes of it
    lookups++

    // Answered with the ones given
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(organizations),
    })
  })

  // A reader of the count, so the caller sees it climb
  return () => lookups
}

/**
 * Answers the reads a page makes on its own account, with the emptiest thing that renders.
 *
 * A spec that leaves those to whatever the author has running locally passes on that machine and
 * nowhere else. A spec these are the subject of registers its own stub afterwards, which is the one
 * Playwright then tries first.
 *
 * @param page - The page to intercept the reads on.
 */
export async function stubAmbientReads(page: Page): Promise<void> {
  // Every discussion a page opens, whatever it sits under
  await stubAmbientRead(page, `${BACKEND_ORIGIN}/comments*`, NO_COMMENTS)

  // The reader's own lists, which the library sidebar asks for
  await stubAmbientRead(page, `${BACKEND_ORIGIN}/users/me/lists`, NO_LISTS)

  // What the site holds on the reader, which the header asks for
  await stubAmbientRead(page, `${BACKEND_ORIGIN}/users/me/profile`, NOTHING_SAID)

  // The organizations the reader is on, which the header asks for
  await stubAmbientRead(page, `${BACKEND_ORIGIN}/users/me/organizations`, NO_ORGANIZATIONS)

  // The reader's own conversations, which opening the header's menu reads ahead
  await stubAmbientRead(page, `${BACKEND_ORIGIN}/defense/sessions/mine`, NO_CONVERSATIONS)

  // The examiner's greeting, which an opened chat shows before it has anything else
  await stubAmbientRead(page, `${BACKEND_ORIGIN}/defense/copy`, MATHILDA_OPENER)
}

/**
 * Records every write of one kind the page sends to the backend.
 *
 * @param page - The page.
 * @param isWrite - Whether an address is one the writes recorded go to.
 *
 * @returns The writes sent so far, oldest first.
 */
export function recordWrites(page: Page, isWrite: (url: URL) => boolean): () => Request[] {
  // Every write that went out, in order
  const writes: Request[] = []

  // Each request the page sends
  page.on('request', (request) => {
    // One of the writes recorded
    if (isWrite(new URL(request.url()))) writes.push(request)
  })

  // A snapshot on each read
  return () => [...writes]
}
