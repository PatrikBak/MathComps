import type {
  CommentDto,
  CommentTarget,
} from '@/components/features/comments/services/comment-api-types'
import {
  newestPostOf,
  saysNothingNew,
  shouldHideComment,
} from '@/components/features/comments/utils/comment-utils'
import { assertNever } from '@/components/shared/utils/assert-never'

import type { PaperOnBoard } from './selection-state'
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
 * The comment target a subject's discussion is held under.
 *
 * @param subject - The subject.
 *
 * @returns The thread's target.
 */
export function discussionTargetOf(subject: DiscussedSubject): CommentTarget {
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
 * The key a thread keeps for as long as it stands. An edit saves its top-level comment under a new id, but keeps who
 * posted it and when, to the millisecond however the server rounds a time it has just written.
 *
 * @template TSubject - What the thread's discussion hangs off.
 *
 * @param thread - The thread.
 *
 * @returns The key.
 */
export function threadKeyOf<TSubject>(thread: DiscussionThread<TSubject>): string {
  // Who posted the top-level comment, and when
  return `${thread.comment.author.id}:${Date.parse(thread.comment.createdAt)}`
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
 * Whether a later list of threads shows nothing new over an earlier one: the same threads, in whatever order, none
 * saying anything new, as {@link saysNothingNew} reads a thread.
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
  // The later list's threads by the key each keeps
  const byKey = new Map(later.map((thread) => [threadKeyOf(thread), thread]))

  // As many threads, each in the later list saying nothing new
  return (
    earlier.length === later.length &&
    earlier.every((thread) => {
      // The same thread in the later list, if it is there
      const now = byKey.get(threadKeyOf(thread))

      // There, and saying nothing new
      return now !== undefined && saysNothingNew([thread.comment], [now.comment])
    })
  )
}
