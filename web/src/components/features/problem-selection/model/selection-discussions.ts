import type {
  CommentDto,
  CommentTargetType,
} from '@/components/features/comments/services/comment-api-types'
import {
  commentDtoKeyOf,
  newestPostOf,
  postsNothingNew,
  shouldHideComment,
} from '@/components/features/comments/utils/comment-utils'
import { assertNever } from '@/components/shared/utils/assert-never'

import type { PaperOnBoard, SelectionIndex } from './selection-state'
import type { Proposal } from './selection-types'

/**
 * A problem the reviewers discuss.
 */
type DiscussedProposal = {
  /** That it is a problem. */
  kind: 'proposal'
  /** The problem. */
  proposal: Proposal
}

/**
 * A paper the reviewers discuss, with the board it is on.
 */
type DiscussedPaper = PaperOnBoard & {
  /** That it is a paper. */
  kind: 'paper'
}

/** Something the selection holds that the reviewers discuss. */
export type DiscussedSubject = DiscussedProposal | DiscussedPaper

/**
 * One subject's discussion.
 *
 * @template TSubject - What the discussion hangs off.
 */
export type Discussion<TSubject> = {
  /** What the discussion hangs off. */
  subject: TSubject
  /** Its top-level comments, oldest first, each carrying its replies. */
  comments: CommentDto[]
}

/**
 * One top-level comment with its replies, and what the discussion it was posted in hangs off.
 *
 * @template TSubject - What the thread's discussion hangs off.
 */
export type DiscussionThread<TSubject> = {
  /** What the thread's discussion hangs off. */
  subject: TSubject
  /** The top-level comment, carrying its replies. */
  comment: CommentDto
}

/**
 * The comment target one of the selection's discussions is held under.
 */
export type DiscussionTarget = {
  /** The kind of discussion: a problem's, or a paper's. */
  targetType: Extract<CommentTargetType, 'Proposal' | 'SelectionPaper'>
  /** The id of the problem or the paper. */
  targetId: string
}

/**
 * Every problem and every paper the selection holds, each as something the reviewers discuss.
 *
 * @param selection - The selection, its problems and papers looked up by id.
 *
 * @returns The problems, then the papers, each paper with the board it is on.
 */
export function discussedSubjectsOf({
  proposalsById,
  papersById,
}: Pick<SelectionIndex, 'proposalsById' | 'papersById'>): DiscussedSubject[] {
  // Every problem, then every paper
  return [
    ...[...proposalsById.values()].map((proposal) => ({ kind: 'proposal' as const, proposal })),
    ...[...papersById.values()].map((place) => ({ kind: 'paper' as const, ...place })),
  ]
}

/**
 * The comment target a subject's discussion is held under.
 *
 * @param subject - The subject.
 *
 * @returns The thread's target.
 */
export function discussionTargetOf(subject: DiscussedSubject): DiscussionTarget {
  // Named by the subject's own id, under its kind of thread
  switch (subject.kind) {
    case 'proposal':
      return { targetType: 'Proposal', targetId: subject.proposal.id }
    case 'paper':
      return { targetType: 'SelectionPaper', targetId: subject.paper.id }
    default:
      return assertNever(subject)
  }
}

/**
 * The key a discussion goes by.
 *
 * @param target - The comment target the discussion is held under.
 *
 * @returns The key.
 */
export function discussionKeyOf(target: DiscussionTarget): string {
  // The kind of discussion and its subject's id
  return `${target.targetType}:${target.targetId}`
}

/**
 * Puts each of some things hanging off the selection's subjects under the subject of the same discussion from a list,
 * leaving one the list has no subject for under its own.
 *
 * @template TItem - What hangs off the subjects.
 *
 * @param items - The things, each under the subject it was read with.
 * @param subjects - The subjects to put them under.
 *
 * @returns Each thing, under the list's subject of its discussion where the list has one.
 */
export function underSubjectsOf<TItem extends Pick<Discussion<DiscussedSubject>, 'subject'>>(
  items: readonly TItem[],
  subjects: readonly DiscussedSubject[]
): TItem[] {
  // The subjects by the key of their discussion
  const byKey = new Map(
    subjects.map((subject) => [discussionKeyOf(discussionTargetOf(subject)), subject])
  )

  // Each thing under the subject of its discussion, where the list has one
  return items.map((item) => ({
    ...item,
    subject: byKey.get(discussionKeyOf(discussionTargetOf(item.subject))) ?? item.subject,
  }))
}

/**
 * The key a thread keeps for as long as it stands: its top-level comment's {@link commentDtoKeyOf} key, which an edit
 * leaves as it was.
 *
 * @template TSubject - What the thread's discussion hangs off.
 *
 * @param thread - The thread.
 *
 * @returns The key.
 */
export function threadKeyOf<TSubject>(thread: DiscussionThread<TSubject>): string {
  // The top-level comment's key
  return commentDtoKeyOf(thread.comment)
}

/**
 * Every top-level comment of the discussions, each with its replies, the one with the newest activity first. A
 * thread's activity is the newest comment or reply posted in it that still stands, so neither an edit nor a reaction
 * moves it. A thread with nothing left to show is left out.
 *
 * @template TSubject - What the discussions hang off.
 *
 * @param discussions - The discussions, each with its top-level comments.
 *
 * @returns The threads, newest activity first, ties broken by the top-level comment's id.
 */
export function threadsByActivity<TSubject>(
  discussions: readonly Discussion<TSubject>[]
): DiscussionThread<TSubject>[] {
  // Every top-level comment with anything to show, with its subject and when it last saw a post
  const threads = discussions.flatMap(({ subject, comments }) =>
    comments
      .filter((comment) => !shouldHideComment(comment))
      .map((comment) => ({ thread: { subject, comment }, activity: newestPostOf(comment) }))
  )

  // The threads, newest activity first
  return threads
    .sort(
      (first, second) =>
        second.activity - first.activity ||
        first.thread.comment.id.localeCompare(second.thread.comment.id)
    )
    .map(({ thread }) => thread)
}

/**
 * What a view shows of some discussions, and what of them it hides.
 *
 * @template TPart - The part of a discussion the view shows or hides as one.
 */
export type InView<TPart> = {
  /** What the view shows. */
  shown: readonly TPart[]
  /** What the view hides. */
  hidden: readonly TPart[]
}

/**
 * The threads of a later list that show something an earlier one didn't: those the earlier list lacks, and those
 * posting anything new over it, as {@link postsNothingNew} reads a thread.
 *
 * @template TSubject - What the threads' discussions hang off.
 *
 * @param earlier - The list as it was.
 * @param later - The list as it is now.
 *
 * @returns Those threads of the later list, in its order.
 */
export function postingNewIn<TSubject>(
  earlier: readonly DiscussionThread<TSubject>[],
  later: readonly DiscussionThread<TSubject>[]
): DiscussionThread<TSubject>[] {
  // The earlier list's threads by the key each keeps
  const byKey = new Map(earlier.map((thread) => [threadKeyOf(thread), thread]))

  // Each later thread the earlier list lacks or that posts something new over it
  return later.filter((thread) => {
    // The same thread in the earlier list, if it was there
    const before = byKey.get(threadKeyOf(thread))

    // Not there, or posting something new since
    return before === undefined || !postsNothingNew([before.comment], [thread.comment])
  })
}

/**
 * The threads a view shows afresh over an earlier list, a discussion at a time: every thread the view shows of each
 * discussion where one of them is new to the earlier list or posts something new over it, as {@link postingNewIn}
 * reads a thread. A discussion counts whole, since one seen mark covers all of it, so a thread shown before counts
 * again once the thread that held the discussion's mark back shows too.
 *
 * @param earlier - The threads the list showed.
 * @param later - The threads the view shows now.
 *
 * @returns Those threads of the later list, in its order.
 */
export function revealedIn(
  earlier: readonly DiscussionThread<DiscussedSubject>[],
  later: readonly DiscussionThread<DiscussedSubject>[]
): DiscussionThread<DiscussedSubject>[] {
  // A function which reads the key of the discussion a thread was posted in
  const keyOfThreadDiscussion = ({ subject }: DiscussionThread<DiscussedSubject>) =>
    discussionKeyOf(discussionTargetOf(subject))

  // The discussions holding a thread that shows something the earlier list didn't
  const revealing = new Set(postingNewIn(earlier, later).map(keyOfThreadDiscussion))

  // Every thread of those discussions
  return later.filter((thread) => revealing.has(keyOfThreadDiscussion(thread)))
}

/**
 * Whether a later list of threads shows nothing new over an earlier one: the same threads, in whatever order, none
 * posting anything new, as {@link postsNothingNew} reads a thread.
 *
 * @template TSubject - What the threads' discussions hang off.
 *
 * @param earlier - The list as it was.
 * @param later - The list as it is now.
 *
 * @returns Whether the later list shows nothing new.
 */
export function showTheSame<TSubject>(
  earlier: readonly DiscussionThread<TSubject>[],
  later: readonly DiscussionThread<TSubject>[]
): boolean {
  // As many threads, none of the later ones showing anything the earlier list didn't
  return earlier.length === later.length && postingNewIn(earlier, later).length === 0
}
