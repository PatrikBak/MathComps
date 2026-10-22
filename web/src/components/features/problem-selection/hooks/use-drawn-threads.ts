'use client'

import { useAuth } from '@clerk/nextjs'

import type { CommentData } from '@/components/features/comments/components/CommentItem'
import {
  type CommentNewness,
  countNewComments,
} from '@/components/features/comments/model/comment-newness'
import { convertToCommentData } from '@/components/features/comments/utils/comment-utils'

import { useSelectionWorkspace } from '../components/SelectionWorkspaceProvider'
import { markKeyOf } from '../model/seen-marks'
import {
  type DiscussedSubject,
  discussionTargetOf,
  type DiscussionThread,
} from '../model/selection-discussions'

/**
 * One thread as a list of them draws it.
 */
export type DrawnThread = {
  /** The thread, with what its discussion hangs off. */
  thread: DiscussionThread<DiscussedSubject>
  /** The thread's top-level comment carrying its replies, read for the reader. */
  comments: CommentData[]
  /** How far the reader has seen the thread's discussion. */
  newness: CommentNewness
}

/**
 * Options for {@link useDrawnThreads}.
 */
type UseDrawnThreadsOptions = {
  /** The threads, in the order the list holds them; null until the first read has landed. */
  threads: readonly DiscussionThread<DiscussedSubject>[] | null
}

/**
 * What {@link useDrawnThreads} hands back.
 */
type UseDrawnThreadsResult = {
  /** Each thread as the list draws it, in the list's order. */
  drawn: DrawnThread[]
  /** How many comments of the list are new to the reader. */
  newCount: number
  /** Marks the discussion of every thread the list shows as seen, as the list shows them. */
  markShownSeen: () => void
}

/**
 * A list of threads as it is drawn for the reader: each thread read against how far the reader has seen its
 * discussion, how many comments are new to them, and the way to mark what the list shows as seen.
 *
 * @param options - {@link UseDrawnThreadsOptions}.
 *
 * @returns The drawn threads, how many comments in them are new, and the way to mark them seen.
 */
export function useDrawnThreads({ threads }: UseDrawnThreadsOptions): UseDrawnThreadsResult {
  // The reader
  const { userId } = useAuth()

  // How far the reader has seen each discussion, and the way to mark some seen
  const { newnessOf, markSeen } = useSelectionWorkspace().seenMarks

  // Each thread as the list draws it, with how far the reader has seen its discussion
  const drawn = (threads ?? []).map(
    (thread): DrawnThread => ({
      thread,
      comments: [convertToCommentData(thread.comment, userId ?? null)],
      newness: newnessOf(discussionTargetOf(thread.subject)),
    })
  )

  // How many comments of the list are new to the reader
  const newCount = drawn.reduce(
    (total, { comments, newness }) => total + countNewComments(comments, newness, userId ?? null),
    0
  )

  // A function which marks the discussion of every thread the list shows as seen, as the list shows them
  const markShownSeen = () => {
    // The discussion of every thread shown
    const targets = drawn.map(({ thread }) => discussionTargetOf(thread.subject))

    // Marked, each discussion named once
    markSeen(
      [...new Map(targets.map((target) => [markKeyOf(target), target])).values()],
      drawn.flatMap(({ comments }) => comments)
    )
  }

  // The drawn threads, how many comments in them are new, and the way to mark them seen
  return { drawn, newCount, markShownSeen }
}
