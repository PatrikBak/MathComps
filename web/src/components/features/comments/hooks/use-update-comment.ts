import { useTranslations } from 'next-intl'

import { uploadKeysIn } from '@/components/shared/utils/media-utils'

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
 * Once the server answers, the cached comment takes its new version's id and edit time. The answer carries no links
 * to files, so the thread of an edit naming an uploaded file is read again for them.
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

    // Once the server has saved the edit
    onSuccess: (result, { commentId, content }, context) => {
      // The comment in the cache under its new version
      context?.queryClient.setQueryData<CommentDto[]>(context.queryKey, (comments) =>
        // A cached thread takes the new version, one not in the cache stays as it is
        comments
          ? updateCommentInTree(comments, commentId, { id: result.id, editedAt: result.editedAt })
          : comments
      )

      // The thread, read again after an edit naming an uploaded file
      if (uploadKeysIn(content).length > 0) {
        void context?.queryClient.invalidateQueries({ queryKey: context.queryKey })
      }
    },

    // The reason shown in the auth prompt
    authReason: t('authReasons.editComment'),

    // The fallback message for when the server craps out without saying why
    errorMessage: t('errors.editFailed'),
  })
}
