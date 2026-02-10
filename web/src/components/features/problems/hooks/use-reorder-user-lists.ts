import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useTranslations } from 'next-intl'
import { toast } from 'sonner'

import { useApi } from '@/hooks/use-api'

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
 * Hook to reorder user lists with optimistic cache update.
 *
 * @returns Mutation function and pending state
 */
export function useReorderUserLists(): UseReorderUserListsResult {
  // API client — requires auth
  const api = useApi({ requireAuth: true })

  // Query client for cache invalidation
  const queryClient = useQueryClient()

  // Translations for error messages
  const t = useTranslations('problems.filters')

  // Reorder mutation with optimistic update
  const mutation = useMutation({
    mutationFn: async (contentIds: string[]) => {
      // Ensure the API client is ready (user is authenticated)
      if (api.state !== 'ready') throw new Error('API not ready')

      // Call the reorder endpoint
      const response = await api.apiCall(() => getListOrderApiUrl(), {
        method: 'PUT',
        body: JSON.stringify({ contentIds }),
        headers: { 'Content-Type': 'application/json' },
      })

      // Rethrow so React Query can handle retries
      if (!response.success) throw response.error
    },

    // Optimistic update — reorder the cached lists immediately
    onMutate: async (contentIds: string[]) => {
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

    // Rollback on error
    onError: (_error, _variables, context) => {
      if (context?.previous) {
        queryClient.setQueryData(userListQueryKeys.lists(), context.previous)
      }
      toast.error(t('reorderListsError'))
    },

    // Refetch on settle to ensure consistency
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: userListQueryKeys.all })
    },
  })

  // Return the mutation
  return {
    reorderLists: mutation.mutate,
    isPending: mutation.isPending,
  }
}
