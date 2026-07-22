import { useAuth } from '@clerk/nextjs'
import { type QueryClient, type QueryKey, useQueryClient } from '@tanstack/react-query'

import type { OptimisticMutationConfig } from '@/hooks/use-optimistic-mutation'
import { useOptimisticMutation } from '@/hooks/use-optimistic-mutation'

import type { CommentDto, CommentTarget } from '../services/comment-api-types'
import { commentQueryKeys } from './comment-query-keys'
import { usePendingCommentTarget } from './use-pending-comment-target'

/**
 * Context for comment mutations - contains rollback state and utilities.
 * Passed to onSuccess/onError callbacks.
 */
type CommentMutationContext = {
  /** The previous comments array before optimistic update (for rollback). */
  previousComments: CommentDto[] | undefined
  /** The React Query client for cache manipulation. */
  queryClient: QueryClient
  /** The query key for the comments cache (derived from target + userId). */
  queryKey: QueryKey
}

/**
 * Configuration for creating a comment mutation with built-in cache management.
 *
 * This is a specialized wrapper around {@link useOptimisticMutation} that handles
 * the common patterns for comment mutations:
 * - Query key derivation from target
 * - Cancel queries → snapshot → rollback pattern
 * - Optimistic cache updates
 *
 * Uses {@link OptimisticMutationConfig} as the base type, picking shared properties
 * and adding the comment-specific `optimisticUpdate` function.
 *
 * @template TData - The type of data returned by the mutation on success.
 * @template TVariables - The type of variables passed to the mutation. Must include `target`.
 */
type CommentMutationConfig<TData, TVariables extends { target: CommentTarget }> = Pick<
  OptimisticMutationConfig<TData, TVariables, CommentMutationContext>,
  | 'apiFn'
  | 'authReason'
  | 'onSuccess'
  | 'errorMessage'
  | 'onBeforeLoginPrompt'
  | 'onLoginPromptDismiss'
> & {
  /**
   * Optional function to optimistically update the comments cache before the API responds.
   * Receives the current comments array and mutation variables.
   * Return the new optimistic state of the comments array.
   * If not provided, no optimistic update will be applied (useful when waiting for server data).
   */
  optimisticUpdate?: (comments: CommentDto[], variables: TVariables) => CommentDto[]
}

/**
 * Creates a comment mutation with built-in cache management, optimistic updates, and rollback.
 *
 * This hook encapsulates the common patterns for comment mutations:
 * - Automatically derives query key from `target` parameter (includes userId for auth-awareness)
 * - Cancels outgoing queries before optimistic update
 * - Snapshots current state for rollback
 * - Applies optimistic update via provided updater function
 * - Rolls back on error automatically
 *
 * @template TData - The type of data returned by the mutation on success.
 * @template TVariables - The type of variables passed to the mutation. Must include `target`.
 *
 * @param config - Configuration for the mutation.
 *
 * @returns A React Query mutation object.
 */
export function useCommentMutation<TData, TVariables extends { target: CommentTarget }>(
  config: CommentMutationConfig<TData, TVariables>
) {
  // Get React Query client
  const queryClient = useQueryClient()

  // Get Clerk auth state
  const { userId } = useAuth()

  // Get the pending target saver
  const { savePendingTarget } = usePendingCommentTarget()

  // Reuse the optimistic mutation logic
  return useOptimisticMutation<TData, TVariables, CommentMutationContext>({
    // Inherited properties
    apiFn: config.apiFn,
    authReason: config.authReason,
    errorMessage: config.errorMessage,
    onSuccess: config.onSuccess,
    onLoginPromptDismiss: config.onLoginPromptDismiss,

    // A custom onBeforeLoginPrompt function which handles saving the pending target
    onBeforeLoginPrompt: (variables) => {
      // Call the original onBeforeLoginPrompt if provided
      config.onBeforeLoginPrompt?.(variables)

      // Save the pending target so we can restore it after login
      savePendingTarget(variables.target)
    },

    // A custom onMutate function which handles cache management
    onMutate: async (variables): Promise<CommentMutationContext> => {
      // Derive the query key from the target
      const queryKey = commentQueryKeys.target(variables.target, userId ?? null)

      // Cancel any outgoing refetches to prevent overwrites
      await queryClient.cancelQueries({ queryKey })

      // Snapshot current data for rollback
      const previousComments = queryClient.getQueryData<CommentDto[]>(queryKey)

      // Apply optimistic update if provided and we have previous data
      if (config.optimisticUpdate && previousComments) {
        queryClient.setQueryData<CommentDto[]>(
          queryKey,
          config.optimisticUpdate(previousComments, variables)
        )
      }

      // Return enriched context with utilities for callbacks
      return { previousComments, queryClient, queryKey }
    },

    // A custom onError function which handles cache rollback
    onError: (_, variables, context) => {
      // If we have a previous state...
      if (context?.previousComments) {
        // Derive the query key from the target
        const queryKey = commentQueryKeys.target(variables.target, userId ?? null)

        // Set the query data back to the previous state
        queryClient.setQueryData(queryKey, context.previousComments)
      }
    },
  })
}
