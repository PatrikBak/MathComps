import type { Page } from '@playwright/test'

import type {
  DefenseReviewConversation,
  DefenseReviewFilterOptions,
} from '@/components/features/admin/defense-review/model/defense-review-types'
import { ROUTES } from '@/i18n/i18n'
import type { PagedList } from '@/lib/api/paged-list'

import messages from '../messages/en.json'
import { BACKEND_ORIGIN } from './support/backend-routes'
import { expect, test } from './support/test'

/** The review queue in English, which is the locale the assertions' copy is taken from. */
const QUEUE_PATH = `/en${ROUTES.ADMIN_DEFENSES}`

/** How many conversations a page of the queue holds, few enough that three of them run onto a second page. */
const PAGE_SIZE = 2

/** How long the fake backend has to answer before a wait is called a failure. */
const SETTLE_TIMEOUT_MS = 15_000

/** Filters with nothing to offer, since no test here is about narrowing the queue. */
const NO_FILTER_OPTIONS: DefenseReviewFilterOptions = {
  users: [],
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
  /** Puts a conversation on top of the queue, as a student speaking in it would. */
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
function conversationOf(email: string, lastActivityAt: string): DefenseReviewConversation {
  // Every field the card reads, the student's address being the one that differs
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
 * Stands in for the queue and its filters, serving the conversations it holds a page at a time.
 *
 * @param page - The page to intercept requests on.
 * @param initial - The conversations already in the queue, most recently active first.
 *
 * @returns The backend, to add to and to watch.
 */
async function installQueueBackend(
  page: Page,
  initial: DefenseReviewConversation[]
): Promise<QueueBackend> {
  // The queue as the backend holds it, most recently active first
  const conversations = [...initial]

  // Every page asked for, in the order the asks arrived
  const asked: number[] = []

  // What an ask waits on before it is answered, which lets everything through until a test holds it
  let gate: Promise<void> = Promise.resolve()

  // The filters, which the page reads as it opens
  await page.route(`${BACKEND_ORIGIN}/admin/defense/filters`, (route) =>
    route.fulfill({ json: NO_FILTER_OPTIONS })
  )

  // The queue itself, which names the page it wants in the body
  await page.route(`${BACKEND_ORIGIN}/admin/defense/sessions/filter`, async (route) => {
    // Which page this ask is for
    const { pageNumber } = route.request().postDataJSON() as QueuePageRequest

    // Recorded as it arrives, so a test holding the answer can still see the ask
    asked.push(pageNumber)

    // Answered only once whatever holds it lets go
    await gate

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

  // A function which puts a conversation on top of the queue
  const arrive = (conversation: DefenseReviewConversation) => {
    conversations.unshift(conversation)
  }

  // A function which holds every ask from here on, handing back the way to let them through
  const hold = () => {
    // The release, filled in by the promise it settles
    let release = () => {}

    // Every ask from here on waits on that promise
    gate = new Promise((resolve) => {
      release = resolve
    })

    // The way to let the held asks through
    return release
  }

  // A snapshot of the asks so far, so the list cannot grow underneath an assertion
  const pagesAsked = () => [...asked]

  // The backend, to add to and to watch
  return { arrive, hold, pagesAsked }
}

test.describe('the review queue', () => {
  test('reads every loaded page again on refresh, putting a new conversation on top', async ({
    page,
  }) => {
    // Three conversations, which run onto a second page
    const backend = await installQueueBackend(page, [
      conversationOf('first@students.test', '2026-09-27T10:00:00Z'),
      conversationOf('second@students.test', '2026-09-27T09:00:00Z'),
      conversationOf('third@students.test', '2026-09-27T08:00:00Z'),
    ])

    // Every student's address on the cards, top to bottom
    const addresses = page.getByText(/@students\.test$/)

    // Open the queue
    await page.goto(QUEUE_PATH)

    // Which reads both pages, asking for the second on its own
    await expect(addresses).toHaveText(
      ['first@students.test', 'second@students.test', 'third@students.test'],
      { timeout: SETTLE_TIMEOUT_MS }
    )

    // How many reads the queue took to get here
    const asksBefore = backend.pagesAsked().length

    // A student speaks up after the queue loaded
    backend.arrive(conversationOf('new@students.test', '2026-09-27T11:00:00Z'))

    // The backend holds its answer, so the refresh can be caught in flight
    const release = backend.hold()

    // The refresh button
    const refresh = page.getByRole('button', { name: messages.admin.defenseReview.refresh })

    // Pressed
    await refresh.click()

    // The button stands disabled while the queue is read again, so a second press can't stack another read
    await expect(refresh).toBeDisabled()

    // The backend answers
    release()

    // The new conversation lands on top, and every card loaded before stays on screen under it
    await expect(addresses).toHaveText([
      'new@students.test',
      'first@students.test',
      'second@students.test',
      'third@students.test',
    ])

    // Both loaded pages were read again, in order, and nothing else was
    expect(backend.pagesAsked().slice(asksBefore)).toEqual([1, 2])

    // The button is ready to be pressed again
    await expect(refresh).toBeEnabled()
  })
})
