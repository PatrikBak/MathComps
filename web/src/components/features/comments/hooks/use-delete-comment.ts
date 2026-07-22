import { useTranslations } from 'next-intl'

import { useProblemStore } from '@/stores/problem-store'

import type { CommentTarget } from '../services/comment-api-types'
import { deleteComment } from '../services/comment-service'
import { updateCommentInTree } from '../utils/comment-utils'
import { commentCountQueryKeys } from './comment-query-keys'
import { useCommentMutation } from './use-comment-mutation'

/**
 * Parameters for deleting a comment.
 */
type DeleteCommentParams = {
  /** The ID of the comment to delete. */
  commentId: string
  /** The target the comment belongs to. */
  target: CommentTarget
}

/**
 * Hook for deleting a comment with optimistic updates.
 *
 * @returns A React Query mutation object.
 */
export function useDeleteComment() {
  // Get the translations
  const t = useTranslations('comments')

  // We will need to update the number of comments in the problem store
  // if the comment is deleted from a problem
  const updateProblemCommentCount = useProblemStore((state) => state.updateCommentCount)

  // Reuse a helper
  return useCommentMutation<void, DeleteCommentParams>({
    // Call the API
    apiFn: (apiCall, { commentId }) => deleteComment(apiCall, commentId),

    // Optimistically update the cache
    optimisticUpdate: (comments, { commentId }) =>
      updateCommentInTree(comments, commentId, { isDeleted: true, content: '' }),

    // When the API call is successful...
    onSuccess: (_, { target }, context) => {
      // If this is a problem comment, count it in the problem store
      if (target.targetType === 'Problem') {
        updateProblemCommentCount(target.targetId, -1)
      } else {
        // Otherwise, invalidate the comment count query for this target
        context?.queryClient.invalidateQueries({
          queryKey: commentCountQueryKeys.forType(target.targetType),
        })
      }
    },

    // The reason shown in the auth prompt
    authReason: t('authReasons.deleteComment'),

    // The error message shown when the server craps out
    errorMessage: t('errors.deleteFailed'),
  })
}
