import { useTranslations } from 'next-intl'

import type { CommentDto, CommentTarget, UpdateCommentResult } from '../services/comment-api-types'
import { updateComment } from '../services/comment-service'
import { updateCommentInTree } from '../utils/comment-utils'
import { useCommentMutation } from './use-comment-mutation'

/**
 * Parameters for updating a comment.
 */
type UpdateCommentParams = {
  /** The ID of the comment to update. */
  commentId: string
  /** The target the comment belongs to. */
  target: CommentTarget
  /** The new content for the comment. */
  content: string
}

/**
 * Hook for updating a comment with optimistic updates.
 *
 * Once the server answers, the cached comment takes its new version's id and edit time.
 *
 * @returns A React Query mutation object.
 */
export function useUpdateComment() {
  // Get the translations
  const t = useTranslations('comments')

  // Reuse the base comment mutation
  return useCommentMutation<UpdateCommentResult, UpdateCommentParams>({
    // Call the API
    apiFn: (apiCall, { commentId, content }) => updateComment(apiCall, commentId, content),

    // Optimistically update the cache
    optimisticUpdate: (comments, { commentId, content }) =>
      updateCommentInTree(comments, commentId, { content, editedAt: new Date().toISOString() }),

    // After success, update with server's actual ID and timestamp
    onSuccess: (result, { commentId }, context) => {
      context?.queryClient.setQueryData<CommentDto[]>(context.queryKey, (comments) =>
        // A cached thread takes the new version, one not in the cache stays as it is
        comments
          ? updateCommentInTree(comments, commentId, { id: result.id, editedAt: result.editedAt })
          : comments
      )
    },

    // The reason shown in the auth prompt
    authReason: t('authReasons.editComment'),

    // The fallback message for when the server craps out without saying why
    errorMessage: t('errors.editFailed'),
  })
}
