import { useUser } from '@clerk/nextjs'
import { useQueryClient } from '@tanstack/react-query'

import { type CommentDto } from '../api/comment-api-types'
import { commentQueryKeys } from './comment-query-keys'

/**
 * Result of the {@link useInvalidateUserComments} hook
 */
type UseInvalidateUserCommentsResult = {
  /**
   * Invalidates only queries where the user has authored a comment.
   * This prevents reloading all comments on the site.
   */
  invalidateUserComments: () => Promise<void>
}

/**
 * Hook for invalidating queries where the user has authored a comment.
 * This is useful when the user updates their profile (avatar, name)
 */
export function useInvalidateUserComments(): UseInvalidateUserCommentsResult {
  // We need to have a user
  const { user } = useUser()

  // Get the query client that will do the invalidation
  const queryClient = useQueryClient()

  // Return the invalidation function
  return {
    invalidateUserComments: async () => {
      // Ensure we have a user
      if (!user) return

      // Perform conditional invalidation
      await queryClient.invalidateQueries({
        predicate: (query) => {
          // Filter for comment queries
          if (query.queryKey[0] !== commentQueryKeys.all[0]) return false

          // Get the comments from the query
          const comments = query.state.data as CommentDto[]

          // A helper function to recursively check for user comments
          const hasUserComment = (list: CommentDto[]): boolean => {
            return list.some(
              (comment) => comment.author.id === user.id || hasUserComment(comment.replies)
            )
          }

          // The query should be invalidated if the user has any comments
          return hasUserComment(comments)
        },
      })
    },
  }
}
