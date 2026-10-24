import type { Page, Route } from '@playwright/test'

import type {
  CommentDto,
  CommentTargetType,
  CommentThreadSeenDto,
} from '@/components/features/comments/services/comment-api-types'
import { countAllComments } from '@/components/features/comments/utils/comment-utils'
import type {
  DiscussionsSeenUpTo,
  SelectionData,
  SelectionDiscussions,
  SelectionDiscussionsSeen,
} from '@/components/features/problem-selection/model/selection-types'
import { assertNever } from '@/components/shared/utils/assert-never'
import { parseMember } from '@/components/shared/utils/collection-utils'

import { answerJson, BACKEND_ORIGIN, refuse } from './backend-routes'
import { asSentTo, READER_ID, senderOf, stubComments, threadKey } from './comments'
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
 * How far the reader has seen the selection's discussions, as the backend keeps it, and every mark the app wrote.
 */
export type SeenMemory = {
  /** The moment up to which the reader has seen each discussion, by {@link threadKey}, as an ISO 8601 string. */
  marks: Map<string, string>
  /** Every mark the app wrote, oldest first, as it sent it. */
  writes: DiscussionsSeenUpTo[]
}

/**
 * One discussion a mark written lands on.
 */
type MarkedDiscussion = {
  /** The id of what the discussion hangs off. */
  targetId: string
  /** The discussion, by {@link threadKey}. */
  key: string
  /** The moment the mark carries for the discussion, as an ISO 8601 string. */
  markedUpTo: string
}

/**
 * When each comment still standing that somebody other than the reader posted in a discussion was posted, for those
 * posted after the reader's mark, oldest first.
 *
 * @param comments - The discussion's comments, replies nested.
 * @param seenUpTo - The reader's mark on the discussion, as an ISO 8601 string; null where they have seen nothing.
 *
 * @returns The posting times, as the backend writes a time.
 */
function newPostedAt(comments: readonly CommentDto[], seenUpTo: string | null): string[] {
  // When each standing comment somebody else posted was posted, replies included
  const posted = comments.flatMap(function postedIn(comment): number[] {
    // The comment, where somebody else posted it and it stands
    const itself =
      !comment.isDeleted && comment.author.id !== READER_ID ? [Date.parse(comment.createdAt)] : []

    // The comment's own time, followed by those of the replies under it
    return [...itself, ...comment.replies.flatMap(postedIn)]
  })

  // Those after the mark, oldest first, as the backend writes a time
  return posted
    .filter((postedAt) => seenUpTo === null || postedAt > Date.parse(seenUpTo))
    .sort((earlier, later) => earlier - later)
    .map((postedAt) => new Date(postedAt).toISOString())
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
 * Stands in for the selection's discussions: each read and written into, how many comments each holds, all of them
 * read at once, and how far the reader has seen them. Any other kind of thread goes to the stubs beneath.
 *
 * @param page - The page to answer the discussions' calls on.
 * @param discussions - Each discussion's comments, by {@link threadKey}, oldest first, replies nested, which each
 * write that goes through changes.
 * @param seen - How far the reader has seen the discussions, which each mark written changes, and every mark the app
 * wrote.
 * @param held - A function reading what the backend holds right now, which a discussion hangs off.
 * @param shown - A function reading what the selection's read shows right now, whose discussions are all read at
 * once.
 * @param answer - {@link AnswerSelectionRead}.
 */
export async function stubSelectionComments(
  page: Page,
  discussions: Map<string, CommentDto[]>,
  seen: SeenMemory,
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

  // How far the reader has seen every discussion of what the selection's read shows, and the marks written
  await page.route(`${BACKEND_ORIGIN}${SELECTION_API_PATH}/comments/seen`, async (route) => {
    // A function which reads what the read shows, as the ids of each kind of discussion
    const subjectIds = () => {
      // The problems and the boards shown
      const { proposals, boards } = shown()

      // Each kind's ids
      return {
        Proposal: proposals.map((proposal) => proposal.id),
        SelectionPaper: boards.flatMap((board) => board.papers.map((paper) => paper.id)),
      } satisfies Record<SelectionThreadType, string[]>
    }

    // A mark written, answered with each discussion marked and its moment, the discussions the read does not show
    // passed over
    if (route.request().method() === 'PUT') {
      // What was marked, as the app sent it
      const write = route.request().postDataJSON() as Partial<DiscussionsSeenUpTo>

      // A body leaving out either kind of discussion, or naming a moment that is no time, refused as the backend
      // refuses one
      if (
        write.proposals === undefined ||
        write.papers === undefined ||
        [...Object.values(write.proposals), ...Object.values(write.papers)].some((moment) =>
          Number.isNaN(Date.parse(moment))
        )
      ) {
        return refuse(route, 400, 'MalformedRequest')
      }

      // Logged, as the app sent it
      seen.writes.push({ proposals: write.proposals, papers: write.papers })

      // The moment the marks are written at
      const now = Date.now()

      // The discussions shown
      const ids = subjectIds()

      // A function which reads the discussions of one kind named that the read shows, each with its moment held to now
      const markedOf = (
        targetType: SelectionThreadType,
        moments: Record<string, string>
      ): MarkedDiscussion[] =>
        Object.entries(moments)
          .filter(([targetId]) => ids[targetType].includes(targetId))
          .map(([targetId, moment]) => ({
            targetId,
            key: threadKey(targetType, targetId),
            markedUpTo: new Date(Math.min(Date.parse(moment), now)).toISOString(),
          }))

      // The proposals marked
      const proposals = markedOf('Proposal', write.proposals)

      // The papers marked
      const papers = markedOf('SelectionPaper', write.papers)

      // A function which tells whether a discussion is unmarked or marked short of its moment
      const fallsShort = ({ key, markedUpTo }: MarkedDiscussion) => {
        // The mark before the write
        const before = seen.marks.get(key)

        // Short of the moment, or never written
        return before === undefined || Date.parse(before) < Date.parse(markedUpTo)
      }

      // Every discussion marked
      const marked = [...proposals, ...papers]

      // Each seen up to its moment, a mark already further along left where it is
      marked.filter(fallsShort).forEach(({ key, markedUpTo }) => seen.marks.set(key, markedUpTo))

      // A function which reads the discussions of one kind marked, by the subject's id, each with its moment
      const answerOf = (ofKind: MarkedDiscussion[]) =>
        Object.fromEntries(ofKind.map(({ targetId, markedUpTo }) => [targetId, markedUpTo]))

      // Each discussion marked, with its moment
      return answerJson(route, 200, {
        proposals: answerOf(proposals),
        papers: answerOf(papers),
      } satisfies DiscussionsSeenUpTo)
    }

    // Answered as the selection's read is, refused alike
    return answer(route, () => {
      // The discussions shown
      const ids = subjectIds()

      // A function which reads how far each discussion of one kind is seen, one nothing has happened in included
      const seenOf = (targetType: SelectionThreadType) =>
        Object.fromEntries(
          ids[targetType].map((targetId): [string, CommentThreadSeenDto] => {
            // The reader's mark on the discussion
            const seenUpTo = seen.marks.get(threadKey(targetType, targetId)) ?? null

            // The discussion with its mark and what others posted in it since
            return [
              targetId,
              {
                seenUpTo,
                newPostedAt: newPostedAt(
                  discussions.get(threadKey(targetType, targetId)) ?? [],
                  seenUpTo
                ),
              },
            ]
          })
        )

      // How far each kind is seen
      const read: SelectionDiscussionsSeen = {
        proposals: seenOf('Proposal'),
        papers: seenOf('SelectionPaper'),
      }

      // The marks
      return read
    })
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
