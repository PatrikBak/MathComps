import { assertNever } from '@/components/shared/utils/assert-never'

import type { CommentData } from '../components/CommentItem'

/**
 * A thread that keeps no account of what its reader has seen, so nothing in it is new.
 */
type UntrackedNewness = {
  /** That the thread keeps no account. */
  kind: 'untracked'
}

/**
 * A thread whose reader has seen every comment posted up to a moment.
 */
type SeenNewness = {
  /** That the thread keeps an account. */
  kind: 'seen'
  /**
   * The moment up to which the reader has seen every comment, in milliseconds; null when they have seen nothing in the
   * thread, so every standing comment somebody else posted is new.
   */
  seenUpTo: number | null
}

/** How far a reader has seen a thread, which decides the comments in it that are new to them. */
export type CommentNewness = UntrackedNewness | SeenNewness

/**
 * Whether a comment is one that can be new to its reader at all: somebody else's, and still standing.
 *
 * @param comment - The comment.
 * @param readerId - The reader's id with the sign-in provider, or null when nobody is signed in.
 *
 * @returns Whether the comment can be new to the reader.
 */
function canBeNew(comment: CommentData, readerId: string | null): boolean {
  // Standing, and somebody else's
  return !comment.isDeleted && comment.authorId !== readerId
}

/**
 * When the newest comment of a thread that can be new to its reader was posted, replies at any depth included. Seeing
 * the thread up to that moment sees every comment in it that can be new.
 *
 * @param comments - The thread's top-level comments, each carrying its replies.
 * @param readerId - The reader's id with the sign-in provider, or null when nobody is signed in.
 *
 * @returns The moment, in milliseconds; null where the thread holds no such comment.
 */
export function lastPostedByOthersAt(
  comments: readonly CommentData[],
  readerId: string | null
): number | null {
  // When each comment that can be new was posted, replies included
  const postedAt = comments.flatMap(function postedIn(comment): number[] {
    // The comment, where it can be new
    const itself = canBeNew(comment, readerId) ? [comment.timestamp.getTime()] : []

    // The comment's own moment, followed by those of the replies under it
    return [...itself, ...comment.replies.flatMap(postedIn)]
  })

  // The newest of those moments, null where there is none
  return postedAt.length === 0 ? null : Math.max(...postedAt)
}

/**
 * Whether a comment is new to its reader: somebody else's, still standing, and posted after what the reader has seen.
 * An edit keeps the moment a comment was posted, so it never makes one new again.
 *
 * @param comment - The comment.
 * @param newness - How far the reader has seen the comment's thread.
 * @param readerId - The reader's id with the sign-in provider, or null when nobody is signed in.
 *
 * @returns Whether the comment is new to the reader.
 */
export function isNewComment(
  comment: CommentData,
  newness: CommentNewness,
  readerId: string | null
): boolean {
  // By whether the thread keeps an account of its reader
  switch (newness.kind) {
    // Nothing is new in a thread that keeps none
    case 'untracked':
      return false

    // Somebody else's standing comment, posted after what the reader has seen or in a thread they have seen nothing of
    case 'seen':
      return (
        canBeNew(comment, readerId) &&
        (newness.seenUpTo === null || comment.timestamp.getTime() > newness.seenUpTo)
      )

    // Every kind is handled above
    default:
      return assertNever(newness)
  }
}

/**
 * How many comments of a thread are new to its reader, replies at any depth included.
 *
 * @param comments - The thread's top-level comments, each carrying its replies.
 * @param newness - How far the reader has seen the thread.
 * @param readerId - The reader's id with the sign-in provider, or null when nobody is signed in.
 *
 * @returns How many of the comments are new to the reader.
 */
export function countNewComments(
  comments: readonly CommentData[],
  newness: CommentNewness,
  readerId: string | null
): number {
  // Each comment where it is new, with the new ones among its replies
  return comments.reduce(
    (total, comment) =>
      total +
      (isNewComment(comment, newness, readerId) ? 1 : 0) +
      countNewComments(comment.replies, newness, readerId),
    0
  )
}
