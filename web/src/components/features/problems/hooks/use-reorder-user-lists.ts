import { useQueryClient } from '@tanstack/react-query'
import { useTranslations } from 'next-intl'

import { useOptimisticMutation } from '@/hooks/use-optimistic-mutation'

import { getListOrderApiUrl } from '../services/user-list-api-urls'
import type { UserListsResponse } from '../types/user-list-types'
import { userListQueryKeys } from './use-user-lists'

/**
 * Return type for {@link useReorderUserLists}.
 */
type UseReorderUserListsResult = {
  /** Call to reorder lists by content IDs (in the new order) */
  reorderLists: (contentIds: string[]) => void
  /** Whether the mutation is currently in progress */
  isPending: boolean
}

/**
 * The cache snapshot kept for rollback if a reorder fails.
 */
type ReorderContext = {
  /** The cached lists before the optimistic reorder. */
  previous: UserListsResponse | undefined
}

/**
 * Hook to reorder user lists with optimistic cache update.
 *
 * @returns Mutation function and pending state
 */
export function useReorderUserLists(): UseReorderUserListsResult {
  // Query client for cache invalidation
  const queryClient = useQueryClient()

  // Translations for error and auth-prompt messages
  const t = useTranslations('problems.filters')

  // Reorder mutation with optimistic update
  const mutation = useOptimisticMutation<void, string[], ReorderContext>({
    // Call the reorder endpoint
    apiFn: (apiCall, contentIds) =>
      apiCall<void>(() => getListOrderApiUrl(), {
        method: 'PUT',
        body: JSON.stringify({ contentIds }),
        headers: { 'Content-Type': 'application/json' },
      }),

    // Optimistic update — reorder the cached lists immediately
    onMutate: async (contentIds) => {
      // Cancel in-flight queries to prevent overwriting our optimistic data
      await queryClient.cancelQueries({ queryKey: userListQueryKeys.lists() })

      // Snapshot the previous cache for rollback
      const previous = queryClient.getQueryData<UserListsResponse>(userListQueryKeys.lists())

      // Optimistically reorder the cached lists
      if (previous) {
        // Build a content-ID-to-list lookup for O(1) access
        const listMap = new Map(previous.lists.map((list) => [list.contentId, list]))

        // Reorder the lists array to match the new content ID order
        const reordered = contentIds.map((id) => listMap.get(id)).filter(Boolean)

        // Setup the new order in the cache
        queryClient.setQueryData<UserListsResponse>(userListQueryKeys.lists(), {
          ...previous,
          lists: reordered as UserListsResponse['lists'],
        })
      }

      // Return snapshot for rollback
      return { previous }
    },

    // Roll back to the snapshot on failure
    onError: (_error, _contentIds, context) => {
      // Restore the pre-reorder order
      if (context?.previous) {
        queryClient.setQueryData(userListQueryKeys.lists(), context.previous)
      }
    },

    // Refetch on settle to ensure consistency
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: userListQueryKeys.all })
    },

    // The reason shown in the auth prompt
    authReason: t('authReasons.manageLists'),

    // Fallback copy when the failure carried no recognized code
    errorMessage: t('reorderListsError'),
  })

  // Return the mutation
  return {
    reorderLists: mutation.mutate,
    isPending: mutation.isPending,
  }
}
