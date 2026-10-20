import type { Page, Route } from '@playwright/test'

import type {
  CommentDto,
  CommentTargetType,
} from '@/components/features/comments/services/comment-api-types'
import { countAllComments } from '@/components/features/comments/utils/comment-utils'
import type {
  SelectionData,
  SelectionDiscussions,
} from '@/components/features/problem-selection/model/selection-types'
import { assertNever } from '@/components/shared/utils/assert-never'
import { parseMember } from '@/components/shared/utils/collection-utils'

import { answerJson, BACKEND_ORIGIN } from './backend-routes'
import { asSentTo, senderOf, stubComments, threadKey } from './comments'
import { type HeldSelection, SELECTION_API_PATH } from './selection-writes'

/** The kinds of thread the selection's backend keeps. */
const SELECTION_THREAD_TYPES = [
  'Proposal',
  'SelectionPaper',
] as const satisfies readonly CommentTargetType[]

/** One kind of thread the selection's backend keeps: a problem's discussion or a paper's. */
type SelectionThreadType = (typeof SELECTION_THREAD_TYPES)[number]

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
 * A function which answers a read of the selection's the way its own read is answered right now: with what it
 * reads, or refused alike.
 *
 * @param route - The read.
 * @param read - A function reading what the read reads, where it is not refused.
 *
 * @returns A promise settling once the read is answered.
 */
export type AnswerSelectionRead = (route: Route, read: () => unknown) => Promise<void>

/**
 * Stands in for the selection's discussions: each read and written into, how many comments each holds, and all of
 * them read at once. Any other kind of thread goes to the stubs beneath.
 *
 * @param page - The page to answer the discussions' calls on.
 * @param discussions - Each discussion's comments, by {@link threadKey}, oldest first, replies nested, which each
 * write that goes through changes.
 * @param held - A function reading what the backend holds right now, which a discussion hangs off.
 * @param shown - A function reading what the selection's read shows right now, whose discussions are all read at
 * once.
 * @param answer - {@link AnswerSelectionRead}.
 */
export async function stubSelectionComments(
  page: Page,
  discussions: Map<string, CommentDto[]>,
  held: () => HeldSelection,
  shown: () => Pick<SelectionData, 'proposals' | 'boards'>,
  answer: AnswerSelectionRead
): Promise<void> {
  // The discussions themselves, each hanging off something the backend holds
  await stubComments(page, discussions, {
    threadTypes: SELECTION_THREAD_TYPES,
    holds: (targetType, targetId) => holdsSubject(held(), targetType, targetId),
  })

  // Every discussion of what the selection's read shows, the ones nothing has been said in left out
  await page.route(`${BACKEND_ORIGIN}${SELECTION_API_PATH}/comments`, (route) =>
    // Answered as the selection's read is, refused alike
    answer(route, () => {
      // What the read shows
      const { proposals, boards } = shown()

      // Who asked, whose own comments and reactions come back under their sign-in's id
      const sender = senderOf(route.request())

      // A function which reads one kind of thread's discussions by the subject's id, leaving out the silent ones
      const discussionsOf = (targetType: SelectionThreadType, targetIds: string[]) =>
        Object.fromEntries(
          targetIds.flatMap((targetId) => {
            // What has been said in the subject's discussion
            const comments = discussions.get(threadKey(targetType, targetId)) ?? []

            // Kept only where anything has been said, as the sender gets it
            return comments.length === 0
              ? []
              : [[targetId, comments.map((comment) => asSentTo(comment, sender))]]
          })
        )

      // The problems' discussions, and the papers'
      const read: SelectionDiscussions = {
        proposals: discussionsOf(
          'Proposal',
          proposals.map((proposal) => proposal.id)
        ),
        papers: discussionsOf(
          'SelectionPaper',
          boards.flatMap((board) => board.papers.map((paper) => paper.id))
        ),
      }

      // The discussions
      return read
    })
  )

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
        // How many comments stand in it, replies included
        const count = countAllComments(discussions.get(threadKey(targetType, targetId)) ?? [])

        // Kept only where there are any
        return count === 0 ? [] : [[targetId, count]]
      })
    )

    // The counts, by thread
    return answerJson(route, 200, counts)
  })
}
