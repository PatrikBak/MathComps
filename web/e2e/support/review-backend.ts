import type { Page } from '@playwright/test'

import type {
  AdminConversation,
  StudentGrading,
} from '@/components/features/admin/conversation/model/admin-conversation'
import type {
  DefenseReviewConversation,
  DefenseReviewFilterOptions,
} from '@/components/features/admin/defense-review/model/defense-review-types'
import type { PagedList } from '@/lib/api/paged-list'

import { partlyReadConversationOf, wholeConversationOf } from './admin-conversation'
import { createAnswerGate } from './answer-gate'
import { BACKEND_ORIGIN } from './backend-routes'
import { installConversationBackend } from './conversation-backend'

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
 * What the page sends to mark a whole set of conversations read at once.
 */
type MarkManyRequest = {
  /** The conversations to mark read. */
  sessionIds: string[]
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
  /** The body of each request marking a whole set at once, oldest first, as the page sent it. */
  bulkMarks: () => MarkManyRequest[]
}

/**
 * What to vary about the fake.
 */
type QueueBackendOptions = {
  /** Where each student stands on the grade, by the student; a student left out is graded nowhere. */
  grading?: Record<string, StudentGrading>
  /** The conversations read halfway, by their ids. */
  partlyRead?: string[]
}

/**
 * Builds one conversation as the queue lists it, told apart from the others by its id.
 *
 * @param email - The address of the student who held it.
 * @param lastActivityAt - When something was last said in it.
 * @param id - Its id, for a student who held more than one.
 *
 * @returns The conversation.
 */
export function conversationOf(
  email: string,
  lastActivityAt: string,
  id = `session-${email}`
): DefenseReviewConversation {
  // The conversation, told apart by its id and dated by its last activity
  return {
    id,
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
 * @returns The conversation in full.
 */
function detailOf(conversation: DefenseReviewConversation): AdminConversation {
  // The same conversation, whole, started when it was last spoken in
  return wholeConversationOf({
    id: conversation.id,
    user: conversation.user,
    target: conversation.target,
    statement: 'Find every x with x + x = 4.',
    reference: 'Halve both sides.',
    answer: 'The answer is 2.',
    startedAt: conversation.lastActivityAt,
  })
}

/**
 * Stands in for the review queue, its filters, each conversation in it, and marking a whole set read, serving the
 * queue a page at a time.
 *
 * @param page - The page to intercept requests on.
 * @param initial - The conversations already in the queue, most recently active first.
 * @param options - What to vary about the fake.
 *
 * @returns The backend, to add to, to hold and to watch.
 */
export async function installQueueBackend(
  page: Page,
  initial: DefenseReviewConversation[],
  options: QueueBackendOptions = {}
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

  // A function which builds each conversation the queue holds in full, read halfway where the options say so
  const details = () =>
    conversations.map((conversation) =>
      options.partlyRead?.includes(conversation.id) === true
        ? // Read halfway
          partlyReadConversationOf(detailOf(conversation))
        : // As built, nothing yet read
          detailOf(conversation)
    )

  // What the conversation dialog reads, graded where the options say so
  await installConversationBackend(page, details, (userId) => options.grading?.[userId] ?? null)

  // Every request marking a whole set, as each body arrived
  const bulkBodies: MarkManyRequest[] = []

  // A whole set marked read at once
  await page.route(`${BACKEND_ORIGIN}/admin/defense/sessions/review`, (route) => {
    // What the page sent
    const body = route.request().postDataJSON() as MarkManyRequest

    // Recorded as it arrives
    bulkBodies.push(body)

    // Every conversation the set names, read as of now in the queue the backend holds
    conversations.forEach((conversation, index) => {
      // Left alone unless the set names it
      if (!body.sessionIds.includes(conversation.id)) return

      // Read, with nothing new in it
      conversations[index] = {
        ...conversation,
        readAt: new Date().toISOString(),
        isUnread: false,
        unreadStudentMessageCount: 0,
      }
    })

    // Taken
    return route.fulfill({ status: 204 })
  })

  // A function which puts a conversation on top of the queue
  const arrive = (conversation: DefenseReviewConversation) => {
    conversations.unshift(conversation)
  }

  // A function which snapshots the asks so far, so the list cannot grow underneath an assertion
  const pagesAsked = () => [...asked]

  // A function which snapshots the bulk marks so far, so the list cannot grow underneath an assertion
  const bulkMarks = () => [...bulkBodies]

  // The backend, to add to, to hold and to watch
  return { arrive, hold: answers.hold, pagesAsked, bulkMarks }
}
