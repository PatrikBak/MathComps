import { useAuth } from '@clerk/nextjs'

import { PENDING_COMMENT_REACTION_STORAGE_KEY } from '@/constants/local-storage-constants'
import { useRestorePendingAction } from '@/hooks/use-restore-pending-action'

import type { CommentData } from '../components/CommentItem'
import type { CommentTarget } from '../services/comment-api-types'
import { findCommentInTree } from '../utils/comment-utils'
import { type CommentReactionPress, usePressCommentReaction } from './use-press-comment-reaction'

/**
 * Options for {@link usePendingCommentReaction}.
 */
type UsePendingCommentReactionOptions = {
  /** The thread's comments, replies nested, or undefined until they can be pressed on. */
  comments: CommentData[] | undefined
  /** The thread the comments belong to. */
  target: CommentTarget
}

/**
 * Hook that presses again, after the reader signs in, the reaction they pressed while signed out.
 *
 * @param options - The thread, and its comments once they can be pressed on.
 */
export function usePendingCommentReaction({ comments, target }: UsePendingCommentReactionOptions) {
  // The reader's id
  const { userId } = useAuth()

  // A function which presses a reaction on one of the thread's comments
  const pressReaction = usePressCommentReaction(target)

  // Press the pending reaction again through the generic restoration hook, except on a comment deleted since, on the
  // reader's own comment, or when the reader already holds that reaction, which pressing would take back
  useRestorePendingAction<CommentData, CommentReactionPress>({
    storageKey: PENDING_COMMENT_REACTION_STORAGE_KEY,
    getItem: ({ commentId }) =>
      comments ? findCommentInTree(comments, (comment) => comment.id === commentId) : undefined,
    shouldExecute: (comment, { kind }) =>
      !comment.isDeleted && comment.viewerReaction !== kind && comment.authorId !== userId,
    onExecute: pressReaction,
  })
}
