import type { CommentThreadSeenDto } from '@/components/features/comments/services/comment-api-types'

import type { DiscussionTarget } from './selection-discussions'
import type { DiscussionsSeenWrite, SelectionDiscussionsSeen } from './selection-types'

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
 * Splits the discussions named into the write telling the server they were seen up to a moment.
 *
 * @param targets - The discussions.
 * @param seenUpTo - The moment, in milliseconds.
 *
 * @returns The write, the proposals' ids apart from the papers'.
 */
export function seenWriteOf(
  targets: readonly DiscussionTarget[],
  seenUpTo: number
): DiscussionsSeenWrite {
  // A function which reads the ids of the discussions of one kind
  const idsOf = (targetType: DiscussionTarget['targetType']) =>
    targets.filter((target) => target.targetType === targetType).map((target) => target.targetId)

  // Each kind's ids, with the moment
  return {
    proposalIds: idsOf('Proposal'),
    paperIds: idsOf('SelectionPaper'),
    seenUpTo: new Date(seenUpTo).toISOString(),
  }
}

/**
 * The marks with the discussions a write named seen up to the moment the server marked them seen up to, a mark already
 * further along left where it is, as the server leaves it.
 *
 * @param seen - The marks as cached.
 * @param write - The discussions written.
 * @param seenUpTo - The moment the server marked them seen up to.
 *
 * @returns The marks afterwards, a discussion they did not hold yet carrying no post by anybody else.
 */
export function withSeenUpTo(
  seen: SelectionDiscussionsSeen,
  write: DiscussionsSeenWrite,
  seenUpTo: string
): SelectionDiscussionsSeen {
  // A function which marks the discussions of one kind
  const marked = (marks: SelectionDiscussionsSeen['proposals'], ids: readonly string[]) => ({
    ...marks,
    ...Object.fromEntries(
      ids.map((id) => {
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
    proposals: marked(seen.proposals, write.proposalIds),
    papers: marked(seen.papers, write.paperIds),
  }
}
