'use client'

import { useAuth } from '@clerk/nextjs'

import { useFetchComments } from '@/components/features/comments/hooks/use-fetch-comments'
import {
  type CommentNewness,
  countNewComments,
} from '@/components/features/comments/model/comment-newness'
import { convertToCommentData } from '@/components/features/comments/utils/comment-utils'

import { useSelectionWorkspace } from '../components/SelectionWorkspaceProvider'
import type { DiscussionTarget } from '../model/selection-discussions'
import { useDiscussionVisit } from './use-discussion-visit'

/**
 * Options for {@link useSubjectDiscussion}.
 */
type UseSubjectDiscussionOptions = {
  /** The comment target the discussion is held under. */
  target: DiscussionTarget
  /** Whether the page shows the discussion's tab. */
  isShowing: boolean
}

/**
 * What {@link useSubjectDiscussion} hands back.
 */
type UseSubjectDiscussionResult = {
  /** How far the reader has seen the discussion. */
  newness: CommentNewness
  /** Whether somebody else posted in the discussion after what the reader has seen. */
  hasNews: boolean
  /** Whether the discussion as last read holds a comment new to the reader. */
  showsNew: boolean
  /** Marks the discussion as seen as last read, so only what comes after shows as new. */
  markSeen: () => void
}

/**
 * One problem's or paper's discussion on its own page: a visit to it while its tab shows, what in it is new to the
 * reader, and the way to mark it seen.
 *
 * @param options - The discussion's target, and whether the page shows its tab.
 *
 * @returns What in the discussion is new to the reader, and the way to mark it seen.
 */
export function useSubjectDiscussion({
  target,
  isShowing,
}: UseSubjectDiscussionOptions): UseSubjectDiscussionResult {
  // The reader
  const { userId } = useAuth()

  // How far the reader has seen each discussion, and the way to mark some seen
  const { newnessOf, hasNews: hasNewsOf, markSeen: markSeenOf } = useSelectionWorkspace().seenMarks

  // The tab's visit, while it shows
  useDiscussionVisit({ tab: { kind: 'subject', target }, presence: isShowing ? 'shown' : 'closed' })

  // How far the reader has seen this discussion
  const newness = newnessOf(target)

  // The discussion's comments, each carrying its replies
  const { comments } = useFetchComments(target)

  // The discussion's comments, read for the reader
  const shown = comments.map((comment) => convertToCommentData(comment, userId ?? null))

  // Whether any of the discussion's comments is new to the reader
  const showsNew = countNewComments(shown, newness, userId ?? null) > 0

  // Whether somebody else posted in the discussion after what the reader has seen
  const hasNews = hasNewsOf(target)

  // A function which marks the discussion as seen as last read
  const markSeen = () => markSeenOf([{ target, comments: shown }])

  // What in the discussion is new to the reader, and the way to mark it seen
  return { newness, hasNews, showsNew, markSeen }
}
