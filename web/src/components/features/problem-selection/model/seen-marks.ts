import type { CommentData } from '@/components/features/comments/components/CommentItem'
import { lastPostedByOthersAt } from '@/components/features/comments/model/comment-newness'
import type { CommentThreadSeenDto } from '@/components/features/comments/services/comment-api-types'

import type { DiscussionTarget } from './selection-discussions'
import type { DiscussionsSeenUpTo, SelectionDiscussionsSeen } from './selection-types'

/**
 * How far the reader has seen one discussion, as the server holds it, beside how many comments somebody else posted in
 * it since.
 */
type ServerMark = {
  /** The moment up to which the reader has seen the discussion, in milliseconds; null when they have seen nothing. */
  seenUpTo: number | null
  /** How many still-standing comments somebody else posted in the discussion after the reader's mark. */
  newCount: number
}

/** How far the reader has seen each discussion, as the server holds it, by the discussion's key. */
export type ServerMarks = ReadonlyMap<string, ServerMark>

/**
 * One discussion's mark as the page keeps it while a visit to a Comments tab showing the discussion lasts, left where
 * it stands as the server's moves on, until the reader marks the discussion seen.
 */
type KeptMark = {
  /** The moment up to which the reader had seen the discussion, in milliseconds; null when they had seen nothing. */
  seenUpTo: number | null
  /** The visits holding the mark, by an id each keeps, never none; the mark goes once the last lets it go. */
  holders: readonly [string, ...string[]]
}

/** The marks the page keeps, by the discussion's key. */
export type KeptMarks = ReadonlyMap<string, KeptMark>

/**
 * A value for each of some discussions, each kind of subject's by the subject's id.
 */
type ByDiscussionKind<TValue> = {
  /** What there is for each proposal's discussion, by the proposal's id. */
  proposals: Record<string, TValue>
  /** What there is for each paper's discussion, by the paper's id. */
  papers: Record<string, TValue>
}

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
 * Reads what an answer holds for each discussion it names, under the discussion's key.
 *
 * @param byKind - What the answer holds, each kind of subject's by the subject's id.
 * @param read - Reads what the answer holds for one discussion.
 *
 * @returns What was read for each proposal's discussion, then each paper's, under the discussion's key.
 */
function entriesByMarkKey<TValue, TRead>(
  byKind: ByDiscussionKind<TValue>,
  read: (value: TValue) => TRead
): [string, TRead][] {
  // A function which reads one kind's discussions, each under its key
  const entriesOf = (targetType: DiscussionTarget['targetType'], values: Record<string, TValue>) =>
    Object.entries(values).map(([targetId, value]): [string, TRead] => [
      markKeyOf({ targetType, targetId }),
      read(value),
    ])

  // Each proposal's discussion, then each paper's
  return [...entriesOf('Proposal', byKind.proposals), ...entriesOf('SelectionPaper', byKind.papers)]
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
  const markOf = ({ seenUpTo, newPostedAt }: CommentThreadSeenDto): ServerMark => ({
    seenUpTo: seenUpTo === null ? null : Date.parse(seenUpTo),
    newCount: newPostedAt.length,
  })

  // Each proposal's discussion and each paper's, by its key
  return new Map(entriesByMarkKey(seen, markOf))
}

/**
 * Keeps the marks of the discussions a visit shows. A discussion another visit already keeps is shared, so every visit
 * holding it reads alike; any other is kept as the server holds it now.
 *
 * @param kept - The marks the page keeps.
 * @param holderId - The id the visit keeps its marks under.
 * @param keys - The keys of the discussions the visit shows.
 * @param server - How far the reader has seen each discussion, as the server holds it.
 *
 * @returns The marks kept afterwards.
 */
export function holdMarks(
  kept: KeptMarks,
  holderId: string,
  keys: readonly string[],
  server: ServerMarks
): KeptMarks {
  // Every kept mark, each discussion the visit shows with the visit among its holders
  return new Map([
    ...kept,
    ...keys.map((key): [string, KeptMark] => {
      // The mark already kept, if one is
      const held = kept.get(key)

      // Kept as the server holds it, or shared, the visit among its holders once
      return [
        key,
        held === undefined
          ? { seenUpTo: server.get(key)?.seenUpTo ?? null, holders: [holderId] }
          : {
              ...held,
              holders: held.holders.includes(holderId) ? held.holders : [...held.holders, holderId],
            },
      ]
    }),
  ])
}

/**
 * Lets go of the marks a visit kept as it ends. A mark no visit keeps any more goes.
 *
 * @param kept - The marks the page keeps.
 * @param holderId - The id the visit kept its marks under.
 *
 * @returns The marks kept afterwards.
 */
export function releaseMarks(kept: KeptMarks, holderId: string): KeptMarks {
  // Every mark with the visit gone from its holders, those left with none dropped
  return new Map(
    [...kept].flatMap(([key, mark]): [string, KeptMark][] => {
      // The visits still holding the mark
      const [first, ...rest] = mark.holders.filter((holder) => holder !== holderId)

      // The mark kept while any visit still holds it
      return first === undefined ? [] : [[key, { ...mark, holders: [first, ...rest] }]]
    })
  )
}

/**
 * Moves the kept marks of the discussions seen on to the moments they were seen up to, wherever they are kept. A mark
 * already further along stays where it is, as the server leaves it.
 *
 * @param kept - The marks the page keeps.
 * @param marked - Each discussion seen, with the moment it was seen up to.
 *
 * @returns The marks kept afterwards.
 */
export function advanceMarks(kept: KeptMarks, marked: DiscussionsSeenUpTo): KeptMarks {
  // Each marked discussion's moment, by its key, in milliseconds
  const moments = new Map(entriesByMarkKey(marked, (seenUpTo) => Date.parse(seenUpTo)))

  // Each kept mark of a discussion seen moved on to the later of where it stands and its moment, the rest as they were
  return new Map(
    [...kept].map(([key, mark]): [string, KeptMark] => {
      // The moment the discussion was seen up to, absent where it wasn't
      const moment = moments.get(key)

      // The later of the kept mark and the moment, or whichever of them there is
      return [
        key,
        {
          ...mark,
          seenUpTo:
            moment === undefined || mark.seenUpTo === null
              ? (moment ?? mark.seenUpTo)
              : Math.max(mark.seenUpTo, moment),
        },
      ]
    })
  )
}

/**
 * How far the reader has seen a discussion as the page reads it: as kept while a visit keeps it, and as the server
 * holds it otherwise.
 *
 * @param kept - The marks the page keeps.
 * @param server - How far the reader has seen each discussion, as the server holds it.
 * @param key - The discussion's key.
 *
 * @returns The moment, in milliseconds; null when the reader has seen nothing in it.
 */
export function seenUpToOf(kept: KeptMarks, server: ServerMarks, key: string): number | null {
  // The mark a visit keeps, if one does
  const held = kept.get(key)

  // The kept mark, or the server's where no visit keeps one
  return held === undefined ? (server.get(key)?.seenUpTo ?? null) : held.seenUpTo
}

/**
 * How many comments somebody else posted after what the reader has seen, across every discussion the marks hold.
 *
 * @param server - How far the reader has seen each discussion, as the server holds it.
 *
 * @returns How many comments are new to the reader.
 */
export function newCountAcross(server: ServerMarks): number {
  // Each discussion's new comments, added up
  return [...server.values()].reduce((total, { newCount }) => total + newCount, 0)
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
  const moments = [...Map.groupBy(shown, ({ target }) => markKeyOf(target)).values()].flatMap(
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
 * left where it is, as the server leaves it. Only what others posted after the mark stays new in the discussion.
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

        // The later of the discussion's mark and the server's moment
        const after =
          before !== null && Date.parse(before) > Date.parse(seenUpTo) ? before : seenUpTo

        // Seen up to that moment, with only what others posted after it still new
        return [
          id,
          {
            seenUpTo: after,
            newPostedAt: (marks[id]?.newPostedAt ?? []).filter(
              (postedAt) => Date.parse(postedAt) > Date.parse(after)
            ),
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
