import { useAuth } from '@clerk/nextjs'

import { PENDING_COMMENT_LIKE_STORAGE_KEY } from '@/constants/local-storage-constants'
import { useRestorePendingLike } from '@/hooks/use-restore-pending-like'

import type { CommentTarget } from '../api/comment-api-types'
import type { CommentData } from '../components/CommentItem'
import { findCommentInTree } from '../utils/comment-utils'
import { useToggleCommentLike } from './use-toggle-comment-like'

/**
 * Hook that applies pending comment likes after user authentication.
 */
export function usePendingCommentLike(comments: CommentData[] | undefined, target: CommentTarget) {
  // Get the current user ID to prevent self-liking
  const { userId } = useAuth()

  // We need the toggle like function to apply the like
  const { mutate: toggleLike } = useToggleCommentLike()

  // Use the generic restoration hook...The hook prevents self-liking and double-liking
  useRestorePendingLike<CommentData>({
    storageKey: PENDING_COMMENT_LIKE_STORAGE_KEY,
    getItem: (id) => (comments ? findCommentInTree(comments, id) : undefined),
    shouldExecute: (comment) => !comment.isLiked && comment.authorId !== userId,
    onExecute: (id) =>
      toggleLike({
        commentId: id,
        target,
        isCurrentlyLiked: false,
      }),
  })
}
