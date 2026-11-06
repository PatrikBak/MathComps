import type { CommentData } from '@/components/features/comments/components/CommentItem'
import {
  type CommentNewness,
  firstNewPostedAt,
  lastPostedByOthersAt,
} from '@/components/features/comments/model/comment-newness'
import type { CommentThreadSeenDto } from '@/components/features/comments/services/comment-api-types'
import { convertToCommentData } from '@/components/features/comments/utils/comment-utils'

import { matchDiscussions, type PoolFilter } from './pool-filters'
import {
  type DiscussedSubject,
  type Discussion,
  discussionKeyOf,
  type DiscussionTarget,
  discussionTargetOf,
  type DiscussionThread,
  type InView,
} from './selection-discussions'
import type {
  Board,
  DiscussionsSeenUpTo,
  SelectionCategory,
  SelectionDiscussionsSeen,
} from './selection-types'

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
 * One discussion, or one thread of it, as a view shows it to the reader or hides it.
 */
export type DiscussionPart = {
  /** The comment target the discussion is held under. */
  target: DiscussionTarget
  /** The comments the view shows or hides of it, each carrying its replies. */
  comments: readonly CommentData[]
}

/**
 * Reads what an answer holds for each discussion it names, under the discussion's key.
 *
 * @param byKind - What the answer holds, each kind of subject's by the subject's id.
 * @param read - Reads what the answer holds for one discussion.
 *
 * @returns What was read for each proposal's discussion, then each paper's, under the discussion's key.
 */
function entriesByDiscussionKey<TValue, TRead>(
  byKind: ByDiscussionKind<TValue>,
  read: (value: TValue) => TRead
): [string, TRead][] {
  // A function which reads one kind's discussions, each under its key
  const entriesOf = (targetType: DiscussionTarget['targetType'], values: Record<string, TValue>) =>
    Object.entries(values).map(([targetId, value]): [string, TRead] => [
      discussionKeyOf({ targetType, targetId }),
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
  return new Map(entriesByDiscussionKey(seen, markOf))
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
  const moments = new Map(entriesByDiscussionKey(marked, (seenUpTo) => Date.parse(seenUpTo)))

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
 * Each thread a view shows or hides as the seen marks read it: the discussion it was posted in, and its top-level
 * comment with its replies, read for the reader.
 *
 * @param threads - The threads the view shows and those it hides.
 * @param readerId - The reader's id with the sign-in provider, or null when nobody is signed in.
 *
 * @returns The view's discussions, one per thread.
 */
export function discussionPartsIn(
  threads: InView<DiscussionThread<DiscussedSubject>>,
  readerId: string | null
): InView<DiscussionPart> {
  // A function which reads one thread for the reader, under its discussion's target
  const readOf = ({ subject, comment }: DiscussionThread<DiscussedSubject>): DiscussionPart => ({
    target: discussionTargetOf(subject),
    comments: [convertToCommentData(comment, readerId)],
  })

  // The threads shown and those hidden, each read
  return { shown: threads.shown.map(readOf), hidden: threads.hidden.map(readOf) }
}

/**
 * What the pool's Comments tab shows of some discussions and what it hides, as the seen marks read it: the threads
 * laid out afresh against the board on screen, each found by what it says now, as {@link matchDiscussions} runs them
 * through the filter.
 *
 * @param discussions - The discussions, each with its top-level comments.
 * @param filter - What the pool is narrowed to.
 * @param activeBoard - The board on screen; null when there is none.
 * @param categories - The selection's categories, in the order they run.
 * @param readerId - The reader's id with the sign-in provider, or null when nobody is signed in.
 *
 * @returns The view's discussions, one per thread.
 */
export function poolDiscussionPartsOf(
  discussions: readonly Discussion<DiscussedSubject>[],
  filter: PoolFilter,
  activeBoard: Board | null,
  categories: readonly SelectionCategory[],
  readerId: string | null
): InView<DiscussionPart> {
  // The threads the filter lets through and those it keeps out, laid out afresh, each read for the reader
  return discussionPartsIn(
    matchDiscussions(discussions, filter, activeBoard, categories, []),
    readerId
  )
}

/**
 * A view of some discussions, with how far the reader has seen each and who the reader is.
 */
type SeenMarking = {
  /**
   * The discussions as the view shows them and the threads of them it hides, a discussion shown as several threads
   * once per thread.
   */
  view: InView<DiscussionPart>
  /** How far the reader has seen each discussion, as the server holds it. */
  server: ServerMarks
  /** The reader's id with the sign-in provider, or null when nobody is signed in. */
  readerId: string | null
}

/**
 * One discussion a view marks seen, with the moment it marks it seen up to.
 */
type SeenMoment = {
  /** The comment target the discussion is held under. */
  target: DiscussionTarget
  /** The moment the discussion is seen up to, in milliseconds. */
  seenUpTo: number
}

/**
 * The moment marking some discussions seen as a view shows them marks each up to: the newest comment it shows that can
 * be new to the reader, so a comment still waiting to be shown in it stays new. A discussion shown as several threads
 * is named once, up to the newest comment across them, and one showing no comment that can be new is left out, since
 * nothing new in it has been seen. Where the view hides some of a discussion's threads, the discussion is seen no
 * further than just before the oldest comment new to the reader in them, as the server holds the reader's mark, so
 * that comment stays new until its thread shows.
 *
 * @param marking - The view, the marks it is read against, and the reader.
 *
 * @returns Each discussion marked, once, with its moment.
 */
function seenMomentsOf({ view, server, readerId }: SeenMarking): SeenMoment[] {
  // The threads the view hides, by the key of their discussion
  const hiddenByKey = Map.groupBy(view.hidden, ({ target }) => discussionKeyOf(target))

  // Each discussion shown, once, with the moment it was seen up to, a discussion showing no comment that can be new
  // left out
  return [...Map.groupBy(view.shown, ({ target }) => discussionKeyOf(target))].flatMap(
    ([key, threads]) => {
      // When the newest comment that can be new was posted, across every thread of the discussion shown
      const newestShown = lastPostedByOthersAt(
        threads.flatMap(({ comments }) => comments),
        readerId
      )

      // Nothing that can be new shown, nothing seen
      if (newestShown === null) return []

      // When the oldest comment new to the reader was posted across the discussion's hidden threads, if any is
      const firstHidden = firstNewPostedAt(
        (hiddenByKey.get(key) ?? []).flatMap(({ comments }) => comments),
        { kind: 'seen', seenUpTo: server.get(key)?.seenUpTo ?? null },
        readerId
      )

      // Seen up to the newest comment shown, stopping short of what is new in the hidden threads
      const seenUpTo = firstHidden === null ? newestShown : Math.min(newestShown, firstHidden - 1)

      // The discussion with its moment
      return [{ target: threads[0].target, seenUpTo }]
    }
  )
}

/**
 * The write telling the server some discussions were seen as a view shows them, each up to the moment
 * {@link seenMomentsOf} reads for it.
 *
 * @param marking - The view, the marks it is read against, and the reader.
 *
 * @returns The write, the proposals' moments apart from the papers'.
 */
export function seenWriteOf(marking: SeenMarking): DiscussionsSeenUpTo {
  // Each discussion marked, with its moment
  const moments = seenMomentsOf(marking)

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
 * Whether marking some discussions seen as a view shows them, up to the moments {@link seenMomentsOf} reads, would stop
 * any comment the view shows as new from being new. It wouldn't where every new comment shown came after a comment new
 * in a thread of the same discussion the view hides.
 *
 * @param marking - The view, the marks it is read against, and the reader.
 * @param newnessOf - How far the reader has seen a discussion, as the view tells its new comments.
 *
 * @returns True where some comment the view shows as new was posted by the moment its discussion would be seen up to.
 */
export function marksAnyShownNew(
  marking: SeenMarking,
  newnessOf: (target: DiscussionTarget) => CommentNewness
): boolean {
  // The moment each discussion would be seen up to, by its key
  const moments = new Map(
    seenMomentsOf(marking).map(({ target, seenUpTo }) => [discussionKeyOf(target), seenUpTo])
  )

  // Some thread shown whose oldest new comment the moment of its discussion reaches
  return marking.view.shown.some(({ target, comments }) => {
    // The moment the thread's discussion would be seen up to
    const moment = moments.get(discussionKeyOf(target))

    // When the thread's oldest new comment was posted
    const firstNew = firstNewPostedAt(comments, newnessOf(target), marking.readerId)

    // The discussion marked, and the thread's oldest new comment posted by the moment it is marked up to
    return moment !== undefined && firstNew !== null && firstNew <= moment
  })
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
