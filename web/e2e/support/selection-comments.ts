import type { Page } from '@playwright/test'

import type {
  CommentDto,
  CommentTarget,
  CommentTargetType,
} from '@/components/features/comments/services/comment-api-types'
import type { UserProfile } from '@/components/features/profile/model/profile-types'
import { assertNever } from '@/components/shared/utils/assert-never'
import { parseMember } from '@/components/shared/utils/collection-utils'

import { answerJson, BACKEND_ORIGIN, refuse } from './backend-routes'
import type { HeldSelection } from './selection-writes'

/** The username of the reviewer a test signs in as, where one is needed to sign a comment. */
const READER_NAME = 'Rita'

/** The kinds of thread the selection's backend keeps. */
const SELECTION_THREAD_TYPES = [
  'Proposal',
  'SelectionPaper',
] as const satisfies readonly CommentTargetType[]

/** One kind of thread the selection's backend keeps: a problem's discussion or a paper's. */
type SelectionThreadType = (typeof SELECTION_THREAD_TYPES)[number]

/**
 * What writing a comment sends, in as much of it as the fake reads.
 */
type CommentRequestBody = {
  /** The thread it goes into. */
  target: CommentTarget
  /** What it says. */
  content: string
}

/**
 * What asking for comment counts sends.
 */
type CountsRequestBody = {
  /** The kind of thread counted. */
  targetType: CommentTargetType
  /** The threads counted, by their ids. */
  targetIds: string[]
}

/**
 * Gives the signed-in reviewer the username {@link READER_NAME}, which a discussion asks for before it takes a
 * comment.
 *
 * @param page - The page to answer the reviewer's profile on.
 */
export async function stubNamedReader(page: Page): Promise<void> {
  // The reviewer's profile, carrying the username
  await page.route(`${BACKEND_ORIGIN}/users/me/profile`, (route) =>
    answerJson(route, 200, {
      graduationYear: null,
      hasLeftHighSchool: true,
      countryCode: null,
      email: null,
      username: READER_NAME,
    } satisfies UserProfile)
  )
}

/**
 * Where the backend keeps one discussion's comments.
 *
 * @param targetType - The kind of thread.
 * @param targetId - Which thread of that kind.
 *
 * @returns The key, naming the thread by its kind and its id together.
 */
export function threadKey(targetType: SelectionThreadType, targetId: string): string {
  // The kind and the id, which together name one thread
  return `${targetType}:${targetId}`
}

/**
 * Whether the backend holds what a discussion hangs off. One in rounds that have opened keeps its thread, though
 * the selection's read leaves it out.
 *
 * @param held - What the backend holds.
 * @param targetType - The kind of thread.
 * @param targetId - Which thread of that kind.
 *
 * @returns True for a problem some proposal files, or a paper on some board.
 */
function holdsSubject(
  held: HeldSelection,
  targetType: SelectionThreadType,
  targetId: string
): boolean {
  // Looked up where its kind is kept
  switch (targetType) {
    // A problem the backend still holds
    case 'Proposal':
      return held.proposals.some((proposal) => proposal.id === targetId)

    // A paper on a board the backend still holds
    case 'SelectionPaper':
      return held.boards.some((board) => board.papers.some((paper) => paper.id === targetId))

    // Every kind is handled above
    default:
      return assertNever(targetType)
  }
}

/**
 * Stands in for the selection's discussions: each read and written into, and how many comments each holds. Any other kind of thread goes to the stubs beneath.
 *
 * @param page - The page to answer the discussions' calls on.
 * @param discussions - Each discussion's comments, by {@link threadKey}, oldest first, which a comment written adds to.
 * @param held - A function reading what the backend holds right now, which a discussion hangs off.
 */
export async function stubSelectionComments(
  page: Page,
  discussions: Map<string, CommentDto[]>,
  held: () => HeldSelection
): Promise<void> {
  // One of the selection's discussions, and a comment written into it
  await page.route(`${BACKEND_ORIGIN}/comments*`, async (route) => {
    // The call as it went out
    const request = route.request()

    // Reading a thread, or writing into one
    switch (request.method()) {
      // The thread, by what it hangs off
      case 'GET': {
        // Which thread
        const query = new URL(request.url()).searchParams

        // The kind of thread, if the selection's backend keeps it
        const targetType = parseMember(query.get('targetType'), SELECTION_THREAD_TYPES)

        // Another kind of thread
        if (targetType === null) return route.fallback()

        // What it hangs off
        const targetId = query.get('targetId') ?? ''

        // Something the backend does not hold has no thread to read
        if (!holdsSubject(held(), targetType, targetId)) {
          return refuse(route, 404, 'CommentTargetNotFound')
        }

        // Every comment in it, oldest first
        return answerJson(route, 200, discussions.get(threadKey(targetType, targetId)) ?? [])
      }

      // A comment, written into a thread
      case 'POST': {
        // What was written, and where
        const { target, content } = request.postDataJSON() as CommentRequestBody

        // The kind of thread, if the selection's backend keeps it
        const targetType = parseMember(target.targetType, SELECTION_THREAD_TYPES)

        // Another kind of thread
        if (targetType === null) return route.fallback()

        // Something the backend does not hold takes no comment
        if (!holdsSubject(held(), targetType, target.targetId)) {
          return refuse(route, 404, 'CommentTargetNotFound')
        }

        // The comment, signed by the reviewer the test signs in as
        const comment: CommentDto = {
          id: crypto.randomUUID(),
          author: { id: 'user_reader', name: READER_NAME, avatarUrl: null },
          content,
          createdAt: new Date().toISOString(),
          editedAt: null,
          isDeleted: false,
          likeCount: 0,
          isLiked: false,
          replies: [],
        }

        // Where the discussion is kept
        const key = threadKey(targetType, target.targetId)

        // At the end of the discussion
        discussions.set(key, [...(discussions.get(key) ?? []), comment])

        // Answered with the comment, as created
        return answerJson(route, 201, comment)
      }

      // Any other call, handed on to the stubs beneath
      default:
        return route.fallback()
    }
  })

  // How many comments each of the selection's discussions holds
  await page.route(`${BACKEND_ORIGIN}/comments/counts`, async (route) => {
    // Which threads are counted
    const body = route.request().postDataJSON() as CountsRequestBody

    // The kind of thread, if the selection's backend keeps it
    const targetType = parseMember(body.targetType, SELECTION_THREAD_TYPES)

    // Another kind of thread, which no stub here counts
    if (targetType === null) return route.fallback()

    // Each thread with anything said in it, the backend leaving out the ones with nothing
    const counts = Object.fromEntries(
      body.targetIds.flatMap((targetId) => {
        // How many comments it holds
        const count = discussions.get(threadKey(targetType, targetId))?.length ?? 0

        // Kept only where there are any
        return count === 0 ? [] : [[targetId, count]]
      })
    )

    // The counts, by thread
    return answerJson(route, 200, counts)
  })
}
