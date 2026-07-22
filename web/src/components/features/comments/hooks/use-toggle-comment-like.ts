import { useLocalStorage } from '@mantine/hooks'
import { useTranslations } from 'next-intl'

import { PENDING_COMMENT_LIKE_STORAGE_KEY } from '@/constants/local-storage-constants'

import type { CommentTarget } from '../services/comment-api-types'
import { toggleCommentLike } from '../services/comment-service'
import { updateCommentInTree } from '../utils/comment-utils'
import { useCommentMutation } from './use-comment-mutation'

/**
 * Parameters for toggling a like on a comment.
 */
type ToggleLikeParams = {
  /** The ID of the comment to toggle like on. */
  commentId: string
  /** The target the comment belongs to. */
  target: CommentTarget
  /** Whether the comment is currently liked by the user. */
  isCurrentlyLiked: boolean
}

/**
 * Hook for toggling a like on a comment with optimistic updates.
 *
 * @returns A React Query mutation object.
 */
export function useToggleCommentLike() {
  // Get the translations
  const t = useTranslations('comments')

  // Local storage for pending comment like ID
  const [_, setPendingLikeId] = useLocalStorage<string | null>({
    key: PENDING_COMMENT_LIKE_STORAGE_KEY,
    defaultValue: null,
  })

  return useCommentMutation<void, ToggleLikeParams>({
    // Call the API
    apiFn: (apiCall, { commentId }) => toggleCommentLike(apiCall, commentId),

    // Optimistically update the cache
    optimisticUpdate: (comments, { commentId, isCurrentlyLiked }) =>
      updateCommentInTree(comments, commentId, {
        isLiked: !isCurrentlyLiked,
        likeCount: (comment) => (isCurrentlyLiked ? comment.likeCount - 1 : comment.likeCount + 1),
      }),

    // The reason shown in the auth prompt
    authReason: t('authReasons.likeComment'),

    // The error message shown when the server craps out
    errorMessage: t('errors.likeFailed'),

    // Ensure we remember they liked the comment so we can apply it after login
    onBeforeLoginPrompt: ({ commentId }) => {
      setPendingLikeId(commentId)
    },

    // Clear the pending like ID when the toast is dismissed
    onLoginPromptDismiss: () => {
      setPendingLikeId(null)
    },
  })
}
