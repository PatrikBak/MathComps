'use client'

import { useAuth } from '@clerk/nextjs'

import type { CommentData } from '@/components/features/comments/components/CommentItem'
import {
  type CommentNewness,
  countNewComments,
} from '@/components/features/comments/model/comment-newness'
import { convertToCommentData } from '@/components/features/comments/utils/comment-utils'

import { useSelectionWorkspace } from '../components/SelectionWorkspaceProvider'
import { discussionPartsIn } from '../model/seen-marks'
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
  /** The threads the list leaves out. */
  hidden: readonly DiscussionThread<DiscussedSubject>[]
}

/**
 * What {@link useDrawnThreads} hands back.
 */
type UseDrawnThreadsResult = {
  /** Each thread as the list draws it, in the list's order. */
  drawn: DrawnThread[]
  /** How many comments of the list are new to the reader. */
  newCount: number
  /**
   * Marks the discussion of every thread the list shows as seen, as the list shows them, short of what is new in the
   * threads it leaves out; null where that would stop no comment the list shows as new from being new.
   */
  markShownSeen: (() => void) | null
}

/**
 * A list of threads as it is drawn for the reader: each thread read against how far the reader has seen its
 * discussion, how many comments are new to them, and the way to mark what the list shows as seen.
 *
 * @param options - {@link UseDrawnThreadsOptions}.
 *
 * @returns The drawn threads, how many comments in them are new, and the way to mark them seen.
 */
export function useDrawnThreads({
  threads,
  hidden,
}: UseDrawnThreadsOptions): UseDrawnThreadsResult {
  // The reader
  const { userId } = useAuth()

  // How far the reader has seen each discussion, the way to mark some seen, and whether doing so leaves fewer
  // comments new
  const { newnessOf, markSeen, marksAnyNew } = useSelectionWorkspace().seenMarks

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

  // The discussions as the list shows them, beside the threads of them it leaves out
  const view = discussionPartsIn({ shown: threads ?? [], hidden }, userId ?? null)

  // A function which marks the discussion of every thread the list shows as seen, as the list shows them, short of
  // what is new in the threads it leaves out, where that stops some comment shown from being new
  const markShownSeen = marksAnyNew(view) ? () => markSeen(view) : null

  // The drawn threads, how many comments in them are new, and the way to mark them seen
  return { drawn, newCount, markShownSeen }
}
