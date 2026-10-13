import { useUser } from '@clerk/nextjs'
import { useQueryClient } from '@tanstack/react-query'

import { type CommentDto } from '../services/comment-api-types'
import { commentQueryKeys } from './comment-query-keys'

/**
 * Result of the {@link useInvalidateUserComments} hook
 */
type UseInvalidateUserCommentsResult = {
  /**
   * Invalidates only queries where the user has authored a comment or reacted to one.
   * This prevents reloading all comments on the site.
   */
  invalidateUserComments: () => Promise<void>
}

/**
 * Hook for invalidating queries where the user has authored a comment or reacted to one.
 * This is useful when the user updates their profile (avatar, name)
 */
export function useInvalidateUserComments(): UseInvalidateUserCommentsResult {
  // We need to have a user
  const { user } = useUser()

  // Get the query client that will do the invalidation
  const queryClient = useQueryClient()

  // A function which invalidates the threads holding the user's comments or reactions
  const invalidateUserComments = async () => {
    // Ensure we have a user
    if (!user) return

    // Perform conditional invalidation
    await queryClient.invalidateQueries({
      predicate: (query) => {
        // Filter for comment queries
        if (query.queryKey[0] !== commentQueryKeys.all[0]) return false

        // Get the comments from the query, which a thread still loading or failed has none of
        const comments = query.state.data as CommentDto[] | undefined

        // Nothing read means nothing of the user's to find
        if (comments === undefined) return false

        // A helper function to recursively check for the user's comments and reactions
        const hasUserCommentOrReaction = (list: CommentDto[]): boolean => {
          // Whether any comment in the list, replies included, is the user's or carries their reaction
          return list.some(
            (comment) =>
              comment.author.id === user.id ||
              comment.reactions.some((reaction) => reaction.userId === user.id) ||
              hasUserCommentOrReaction(comment.replies)
          )
        }

        // The query should be invalidated if the user has any comments or reactions in it
        return hasUserCommentOrReaction(comments)
      },
    })
  }

  // Return the invalidation function
  return { invalidateUserComments }
}
