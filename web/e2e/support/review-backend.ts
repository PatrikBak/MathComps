import type { Page } from '@playwright/test'

import type {
  DefenseReviewConversation,
  DefenseReviewDetail,
  DefenseReviewFilterOptions,
} from '@/components/features/admin/defense-review/model/defense-review-types'
import type { PagedList } from '@/lib/api/paged-list'

import { createAnswerGate } from './answer-gate'
import { BACKEND_ORIGIN } from './backend-routes'

/** How many conversations a page of the queue holds, few enough that a short queue runs onto a second page. */
const PAGE_SIZE = 2

/** Filters with nothing to offer. */
const NO_FILTER_OPTIONS: DefenseReviewFilterOptions = {
  students: [],
  problems: [],
  promptVersions: [],
}

/**
 * The part of a read of the queue that names which page it wants.
 */
type QueuePageRequest = {
  /** Which page, counting from 1. */
  pageNumber: number
}

/**
 * The review queue's backend, held in memory, and what the page has asked of it.
 */
type QueueBackend = {
  /** Puts a new conversation on top of the queue, as a student's first message in it would. */
  arrive: (conversation: DefenseReviewConversation) => void
  /** Keeps every page asked for from here on waiting, until the function handed back lets them through. */
  hold: () => () => void
  /** Which page each read of the queue asked for, oldest first. */
  pagesAsked: () => number[]
}

/**
 * Builds one conversation as the queue lists it, told apart from the others by who held it.
 *
 * @param email - The address of the student who held it.
 * @param lastActivityAt - When something was last said in it.
 *
 * @returns The conversation.
 */
export function conversationOf(email: string, lastActivityAt: string): DefenseReviewConversation {
  // The conversation, told apart by its student's address and dated by its last activity
  return {
    id: `session-${email}`,
    target: {
      kind: 'problem',
      problemId: 'problem-1',
      competitionSlug: 'skmo',
      slug: 'skmo-76-a-i-1',
      source: {
        season: { slug: '76', displayName: 'Edition 76 (2026/2027)', fullName: null },
        startYear: 2026,
        competition: [{ slug: 'skmo', displayName: 'SKMO', fullName: null }],
        number: 1,
      },
    },
    user: { id: `user-${email}`, username: null, email },
    lastStudentMessage: 'The answer is 2.',
    studentMessageCount: 1,
    lastActivityAt,
    readAt: null,
    isUnread: true,
    unreadStudentMessageCount: 1,
    noteCount: 0,
    hasStudentReport: false,
    hasStudentFeedback: false,
  }
}

/**
 * Builds one conversation in full, sharing its id, problem and student with the conversation as the queue lists it.
 *
 * @param conversation - The conversation as the queue lists it.
 *
 * @returns The conversation in full: one opener and one answer, nothing written about it yet.
 */
function detailOf(conversation: DefenseReviewConversation): DefenseReviewDetail {
  // The same conversation, with the exchange itself and nothing yet read or written about it
  return {
    id: conversation.id,
    target: conversation.target,
    user: conversation.user,
    statement: 'Find every x with x + x = 4.',
    reference: 'Halve both sides.',
    examinerConfig: {},
    turns: [
      {
        id: `${conversation.id}-opener`,
        role: 'examiner',
        content: 'Walk me through it.',
        createdAt: conversation.lastActivityAt,
      },
      {
        id: `${conversation.id}-answer`,
        role: 'candidate',
        content: 'The answer is 2.',
        createdAt: conversation.lastActivityAt,
      },
    ],
    attempts: [],
    reports: [],
    feedback: null,
    notes: [],
    readAt: null,
    createdAt: conversation.lastActivityAt,
  }
}

/**
 * Reads where on the backend a request goes.
 *
 * @param url - The request's address.
 *
 * @returns Everything past the backend's origin, query included, or an empty string for a request going anywhere
 * else.
 */
function backendPathOf(url: URL): string {
  // Only the backend's own calls have a path worth matching
  return url.href.startsWith(BACKEND_ORIGIN) ? url.href.slice(BACKEND_ORIGIN.length) : ''
}

/**
 * Stands in for the review queue, its filters, and each conversation in it, serving the queue a page at a time.
 *
 * @param page - The page to intercept requests on.
 * @param initial - The conversations already in the queue, most recently active first.
 *
 * @returns The backend, to add to, to hold and to watch.
 */
export async function installQueueBackend(
  page: Page,
  initial: DefenseReviewConversation[]
): Promise<QueueBackend> {
  // The queue as the backend holds it, most recently active first
  const conversations = [...initial]

  // Every page asked for, in the order the asks arrived
  const asked: number[] = []

  // What an ask of the queue waits at before it is answered
  const answers = createAnswerGate()

  // The filters, which the page reads as it opens
  await page.route(`${BACKEND_ORIGIN}/admin/defense/filters`, (route) =>
    route.fulfill({ json: NO_FILTER_OPTIONS })
  )

  // A page of the queue, named in the read's body
  await page.route(`${BACKEND_ORIGIN}/admin/defense/sessions/filter`, async (route) => {
    // Which page this ask is for
    const { pageNumber } = route.request().postDataJSON() as QueuePageRequest

    // Recorded as it arrives, so a test holding the answer can still see the ask
    asked.push(pageNumber)

    // Answered only once whatever holds it lets go
    await answers.passed()

    // Where that page starts in the queue
    const start = (pageNumber - 1) * PAGE_SIZE

    // The page, cut from the queue as it stands now
    const body: PagedList<DefenseReviewConversation> = {
      items: conversations.slice(start, start + PAGE_SIZE),
      page: pageNumber,
      pageSize: PAGE_SIZE,
      totalCount: conversations.length,
    }

    // Served the way the backend serves a page
    await route.fulfill({ json: body })
  })

  // One conversation in full, found among those the queue holds
  await page.route(
    (url) => /^\/admin\/defense\/sessions\/session-[^/]+$/.test(backendPathOf(url)),
    (route) => {
      // Which conversation the dialog asked for
      const id = decodeURIComponent(new URL(route.request().url()).pathname.split('/').at(-1) ?? '')

      // The conversation, among those the queue holds
      const conversation = conversations.find((candidate) => candidate.id === id)

      // Served whole where the queue holds it
      return conversation === undefined
        ? // Answered as not found
          route.fulfill({ status: 404 })
        : // The conversation in full
          route.fulfill({ json: detailOf(conversation) })
    }
  )

  // Marking one read, which opening it does on its own, or unread
  await page.route(
    (url) => /^\/admin\/defense\/sessions\/session-[^/]+\/review$/.test(backendPathOf(url)),
    (route) => route.fulfill({ status: 204 })
  )

  // A function which puts a conversation on top of the queue
  const arrive = (conversation: DefenseReviewConversation) => {
    conversations.unshift(conversation)
  }

  // A function which snapshots the asks so far, so the list cannot grow underneath an assertion
  const pagesAsked = () => [...asked]

  // The backend, to add to, to hold and to watch
  return { arrive, hold: answers.hold, pagesAsked }
}
