import { useTranslations } from 'next-intl'

import { useProblemStore } from '@/stores/problem-store'

import type { CommentDto, CommentTarget } from '../api/comment-api-types'
import { createComment } from '../api/comment-service'
import { addReplyToComment } from '../utils/comment-utils'
import { commentCountQueryKeys } from './comment-query-keys'
import { useCommentMutation } from './use-comment-mutation'

/**
 * Parameters for creating a new comment.
 */
type CreateCommentParams = {
  /** The target to create the comment on. */
  target: CommentTarget
  /** The content of the comment. */
  content: string
  /** Optional parent comment ID for replies. */
  parentCommentId?: string | null
}

/**
 * Hook for creating a new comment with optimistic updates.
 *
 * @returns A React Query mutation object.
 */
export function useCreateComment() {
  // Get the translations
  const t = useTranslations('comments')

  // We will need to update the number of comments in the problem store
  // if the comment is created on a problem
  const updateProblemCommentCount = useProblemStore((state) => state.updateCommentCount)

  // Reuse a helper
  return useCommentMutation<CommentDto, CreateCommentParams>({
    // Call the API
    apiFn: (apiCall, { target, content, parentCommentId }) =>
      createComment(apiCall, target, content, parentCommentId),

    // No optimistic update - we wait for server to return the new comment with ID
    optimisticUpdate: undefined,

    // When the API call is successful, update the cache
    onSuccess: (newComment, { target, parentCommentId }, context) => {
      // Update the cache with new comments
      context?.queryClient.setQueryData<CommentDto[]>(context.queryKey, (old = []) => {
        // If it's a reply, add it to the parent comment
        if (parentCommentId) {
          return addReplyToComment(old, parentCommentId, newComment)
        }

        // Otherwise, add it to the list of comments
        return [...old, newComment]
      })

      // If this is a problem comment, count it in the problem store
      if (target.targetType === 'Problem') {
        updateProblemCommentCount(target.targetId, 1)
      } else {
        // Otherwise, invalidate the comment count query for this target
        context?.queryClient.invalidateQueries({
          queryKey: commentCountQueryKeys.forType(target.targetType),
        })
      }
    },

    // The reason shown in the auth prompt
    authReason: t('authReasons.addComment'),

    // The error message shown when the server craps out
    errorMessage: t('errors.addFailed'),
  })
}
