import type { Page } from '@playwright/test'

import type {
  AdminConversation,
  StudentConversations,
  StudentGrading,
} from '@/components/features/admin/conversation/model/admin-conversation'
import { assertNever } from '@/components/shared/utils/assert-never'

import { BACKEND_ORIGIN } from './backend-routes'

/**
 * Says where a student stands on the grade for one problem.
 *
 * @param userId - The student.
 * @param problemId - The problem.
 *
 * @returns The grading; null unless the student is graded on the problem.
 */
type GradingOf = (userId: string, problemId: string) => StudentGrading | null

/**
 * The backend the conversation dialog reads from, held in memory, and what the dialog has asked of it.
 */
export type ConversationBackend = {
  /** Every conversation marked read so far, oldest mark first. */
  readMarks: () => string[]
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
 * Reads whether a conversation was held against the problem a list of a student's conversations names.
 *
 * @param conversation - The conversation.
 * @param problemId - The archive problem the list's path names, null where it names a handout environment.
 * @param url - The list's address, whose query names a handout environment.
 *
 * @returns Whether it was held against that problem.
 */
function isHeldAgainst(
  conversation: AdminConversation,
  problemId: string | null,
  url: URL
): boolean {
  // What the conversation was held against
  const { target } = conversation

  // Matched the way each kind is named
  switch (target.kind) {
    // A handout environment, which the query names by both of its ids
    case 'handout':
      return (
        problemId === null &&
        target.handoutContentId === url.searchParams.get('handoutContentId') &&
        target.environmentId === url.searchParams.get('environmentId')
      )

    // An archive problem or a proposed one, which the path names
    case 'problem':
    case 'proposal':
      return target.problemId === problemId

    // A target nothing here knows
    default:
      return assertNever(target)
  }
}

/**
 * Stands in for what the conversation dialog reads and writes: each conversation in full, a student's
 * conversations about one problem, and the read marks.
 *
 * @param page - The page to intercept requests on.
 * @param conversations - Every conversation the backend holds, as it stands when asked.
 * @param gradingOf - {@link GradingOf}.
 *
 * @returns The backend, to watch.
 */
export async function installConversationBackend(
  page: Page,
  conversations: () => readonly AdminConversation[],
  gradingOf: GradingOf
): Promise<ConversationBackend> {
  // Every conversation marked read, in the order the marks arrived
  const marks: string[] = []

  // One conversation in full, never a set of them or the queue read through the same path
  await page.route(
    (url) => /^\/admin\/defense\/sessions\/(?!filter$|review$)[^/]+$/.test(backendPathOf(url)),
    (route) => {
      // Which conversation the dialog asked for
      const id = decodeURIComponent(new URL(route.request().url()).pathname.split('/').at(-1) ?? '')

      // The conversation, among those the backend holds
      const conversation = conversations().find((candidate) => candidate.id === id)

      // Served whole where the backend holds it
      return conversation === undefined
        ? // Answered as not found
          route.fulfill({ status: 404 })
        : // The conversation in full
          route.fulfill({ json: conversation })
    }
  )

  // Marking one read, which opening it does on its own, or unread
  await page.route(
    (url) => /^\/admin\/defense\/sessions\/[^/]+\/review$/.test(backendPathOf(url)),
    (route) => {
      // A mark as read, recorded by the conversation it names
      if (route.request().method() === 'PUT') {
        marks.push(
          decodeURIComponent(new URL(route.request().url()).pathname.split('/').at(-2) ?? '')
        )
      }

      // Taken
      return route.fulfill({ status: 204 })
    }
  )

  // Picking one up again from one of its turns
  await page.route(
    (url) => /^\/admin\/defense\/sessions\/[^/]+\/review\/from\/[^/]+$/.test(backendPathOf(url)),
    (route) => route.fulfill({ status: 204 })
  )

  // One student's conversations about one problem, oldest first, with their grading
  await page.route(
    (url) =>
      /^\/admin\/defense\/students\/[^/]+\/sessions(\/problems\/[^/?]+)?(\?|$)/.test(
        backendPathOf(url)
      ),
    (route) => {
      // The address, which names the student and the problem
      const url = new URL(route.request().url())

      // The student, named right after the students segment
      const userId = decodeURIComponent(url.pathname.split('/students/')[1]?.split('/')[0] ?? '')

      // The archive problem the path names, null on a list about a handout environment
      const problemId = /\/problems\/([^/]+)$/.exec(url.pathname)?.[1] ?? null

      // Their conversations about the problem, oldest first
      const held = conversations()
        .filter(
          (conversation) =>
            conversation.user.id === userId && isHeldAgainst(conversation, problemId, url)
        )
        .sort((first, second) => first.createdAt.localeCompare(second.createdAt))

      // The list, with the grading where the student is graded, only ever on an archive problem
      const body: StudentConversations = {
        conversations: held.map((conversation) => ({
          id: conversation.id,
          createdAt: conversation.createdAt,
        })),
        grading: problemId === null ? null : gradingOf(userId, problemId),
      }

      // Served the way the backend serves it
      return route.fulfill({ json: body })
    }
  )

  // A function which snapshots the marks so far, so the list cannot grow underneath an assertion
  const readMarks = () => [...marks]

  // The backend, to watch
  return { readMarks }
}
