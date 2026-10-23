import type { CommentData } from '@/components/features/comments/components/CommentItem'
import { lastPostedByOthersAt } from '@/components/features/comments/model/comment-newness'
import type { CommentThreadSeenDto } from '@/components/features/comments/services/comment-api-types'
import { groupBy } from '@/components/shared/utils/collection-utils'

import type { DiscussionTarget } from './selection-discussions'
import type { DiscussionsSeenUpTo, SelectionDiscussionsSeen } from './selection-types'

/**
 * How far the reader has seen one discussion, as the server holds it, beside when somebody else last posted in it.
 */
type ServerMark = {
  /** The moment up to which the reader has seen the discussion, in milliseconds; null when they have seen nothing. */
  seenUpTo: number | null
  /** When somebody else last posted a still-standing comment in the discussion, in milliseconds; null when nobody has. */
  lastPostedByOthersAt: number | null
}

/** How far the reader has seen each discussion, as the server holds it, by the discussion's key. */
export type ServerMarks = ReadonlyMap<string, ServerMark>

/**
 * One discussion, or one thread of it, as a view shows it to the reader.
 */
export type ShownDiscussion = {
  /** The comment target the discussion is held under. */
  target: DiscussionTarget
  /** The comments the view shows of it, each carrying its replies. */
  comments: readonly CommentData[]
}

/**
 * The key a discussion goes by among the marks.
 *
 * @param target - The comment target the discussion is held under.
 *
 * @returns The key.
 */
export function markKeyOf(target: DiscussionTarget): string {
  // The kind of thread and its id
  return `${target.targetType}:${target.targetId}`
}

/**
 * Reads the server's answer into the marks by the discussion's key.
 *
 * @param seen - How far the reader has seen the selection's discussions, as the server answered.
 *
 * @returns The marks, a discussion the answer leaves out left out.
 */
export function serverMarksOf(seen: SelectionDiscussionsSeen): ServerMarks {
  // A function which reads one discussion's answer
  const markOf = ({ seenUpTo, lastPostedByOthersAt }: CommentThreadSeenDto): ServerMark => ({
    seenUpTo: seenUpTo === null ? null : Date.parse(seenUpTo),
    lastPostedByOthersAt: lastPostedByOthersAt === null ? null : Date.parse(lastPostedByOthersAt),
  })

  // A function which reads one kind's discussions, each under its key
  const entriesOf = (
    targetType: DiscussionTarget['targetType'],
    marks: Record<string, CommentThreadSeenDto>
  ) =>
    Object.entries(marks).map(([targetId, mark]): [string, ServerMark] => [
      markKeyOf({ targetType, targetId }),
      markOf(mark),
    ])

  // Each proposal's discussion and each paper's, by its key
  return new Map([
    ...entriesOf('Proposal', seen.proposals),
    ...entriesOf('SelectionPaper', seen.papers),
  ])
}

/**
 * Whether a discussion holds anything new to the reader: whether somebody else posted in it after what the reader has
 * seen.
 *
 * @param server - How far the reader has seen each discussion, as the server holds it.
 * @param key - The discussion's key.
 *
 * @returns Whether anything in it is new to the reader.
 */
export function hasNewsIn(server: ServerMarks, key: string): boolean {
  // When somebody else last posted in the discussion, if anybody has
  const lastPostedAt = server.get(key)?.lastPostedByOthersAt ?? null

  // How far the reader has seen the discussion
  const seenUpTo = server.get(key)?.seenUpTo ?? null

  // A post by somebody else, after the reader's mark where they hold one
  return lastPostedAt !== null && (seenUpTo === null || lastPostedAt > seenUpTo)
}

/**
 * The write telling the server some discussions were seen as a view shows them, each up to the newest comment it shows
 * that can be new to the reader, so a comment still waiting to be shown in it stays new. A discussion shown as several
 * threads is named once, up to the newest comment across them, and one showing no comment that can be new is left out,
 * since nothing new in it has been seen.
 *
 * @param shown - The discussions as the view shows them, a discussion shown as several threads once per thread.
 * @param readerId - The reader's id with the sign-in provider, or null when nobody is signed in.
 *
 * @returns The write, the proposals' moments apart from the papers'.
 */
export function seenWriteOf(
  shown: readonly ShownDiscussion[],
  readerId: string | null
): DiscussionsSeenUpTo {
  // Each discussion shown, once, with when the newest comment it shows that can be new was posted, a discussion
  // showing none left out
  const moments = [...groupBy(shown, ({ target }) => markKeyOf(target)).values()].flatMap(
    (threads) => {
      // When the newest comment that can be new was posted, across every thread of the discussion
      const seenUpTo = lastPostedByOthersAt(
        threads.flatMap(({ comments }) => comments),
        readerId
      )

      // The discussion with its moment, where it shows such a comment
      return seenUpTo === null ? [] : [{ target: threads[0].target, seenUpTo }]
    }
  )

  // A function which reads the moments of the discussions of one kind, by the subject's id
  const momentsOf = (targetType: DiscussionTarget['targetType']) =>
    Object.fromEntries(
      moments
        .filter(({ target }) => target.targetType === targetType)
        .map(({ target, seenUpTo }) => [target.targetId, new Date(seenUpTo).toISOString()])
    )

  // Each kind's moments
  return { proposals: momentsOf('Proposal'), papers: momentsOf('SelectionPaper') }
}

/**
 * The marks with each discussion the server marked seen up to the moment it answered, a mark already further along
 * left where it is, as the server leaves it.
 *
 * @param seen - The marks as cached.
 * @param marked - Each discussion the server marked, with the moment it marked it seen up to.
 *
 * @returns The marks afterwards, a discussion they did not hold yet carrying no post by anybody else.
 */
export function withSeenUpTo(
  seen: SelectionDiscussionsSeen,
  marked: DiscussionsSeenUpTo
): SelectionDiscussionsSeen {
  // A function which marks the discussions of one kind, each up to its answered moment
  const markedOf = (
    marks: SelectionDiscussionsSeen['proposals'],
    moments: DiscussionsSeenUpTo['proposals']
  ) => ({
    ...marks,
    ...Object.fromEntries(
      Object.entries(moments).map(([id, seenUpTo]) => {
        // The discussion's mark before the write, if it had one
        const before = marks[id]?.seenUpTo ?? null

        // Seen up to the later of the discussion's mark and the server's moment, its last post by others kept
        return [
          id,
          {
            lastPostedByOthersAt: marks[id]?.lastPostedByOthersAt ?? null,
            seenUpTo:
              before !== null && Date.parse(before) > Date.parse(seenUpTo) ? before : seenUpTo,
          },
        ]
      })
    ),
  })

  // Each kind's marks
  return {
    proposals: markedOf(seen.proposals, marked.proposals),
    papers: markedOf(seen.papers, marked.papers),
  }
}
