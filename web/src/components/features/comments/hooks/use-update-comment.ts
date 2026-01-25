import { useTranslations } from 'next-intl'

import type { CommentDto, CommentTarget, UpdateCommentResult } from '../api/comment-api-types'
import { updateComment } from '../api/comment-service'
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
 * After the server responds, the cache is updated with the server-returned
 * editedAt timestamp to ensure accurate display.
 *
 * @returns A React Query mutation object.
 */
export function useUpdateComment() {
  // Get the translations
  const t = useTranslations('comments')

  // Reuse the base comment mutation
  return useCommentMutation<UpdateCommentResult, UpdateCommentParams>({
    // Call the API
    apiFn: (apiCall, { commentId, target, content }) =>
      updateComment(apiCall, commentId, target, content),

    // Optimistically update the cache
    optimisticUpdate: (comments, { commentId, content }) =>
      updateCommentInTree(comments, commentId, { content, editedAt: new Date().toISOString() }),

    // After success, update with server's actual ID and timestamp
    onSuccess: (result, { commentId }, context) => {
      context?.queryClient.setQueryData<CommentDto[]>(context.queryKey, (comments) =>
        comments
          ? updateCommentInTree(comments, commentId, { id: result.id, editedAt: result.editedAt })
          : comments
      )
    },

    // The reason shown in the auth prompt
    authReason: t('authReasons.editComment'),

    // The error message shown when the server craps out
    errorMessage: t('errors.editFailed'),
  })
}
