import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useTranslations } from 'next-intl'
import { toast } from 'sonner'

import { useApi } from '@/hooks/use-api'

import { getUserListsApiUrl } from '../services/user-list-api-urls'
import type { UserListDto, UserListsResponse } from '../types/user-list-types'
import { userListQueryKeys } from './use-user-lists'

/**
 * Return type for {@link useCreateUserList}.
 */
type UseCreateUserListResult = {
  /** Call to create a new list with the given name */
  createList: (name: string, options?: { onSuccess?: () => void }) => void
  /** Whether the mutation is currently in progress */
  isPending: boolean
}

/**
 * Hook to create a new user list. Invalidates the lists cache on success.
 *
 * @returns Mutation function and pending state
 */
export function useCreateUserList(): UseCreateUserListResult {
  // API client — requires auth
  const api = useApi({ requireAuth: true })

  // Query client for cache invalidation
  const queryClient = useQueryClient()

  // Translations for error messages
  const t = useTranslations('problems.filters')

  // Create list mutation
  const mutation = useMutation({
    mutationFn: async (name: string) => {
      // Ensure the API client is ready (user is authenticated)
      if (api.state !== 'ready') throw new Error('API not ready')

      // Call the create endpoint
      const response = await api.apiCall<UserListDto>(() => getUserListsApiUrl(), {
        method: 'POST',
        body: JSON.stringify({ name }),
        headers: { 'Content-Type': 'application/json' },
      })

      // Rethrow so React Query can handle retries
      if (!response.success) throw response.error

      // Return the created list
      return response.data
    },

    // Optimistically append the new list to the cache, then revalidate
    onSuccess: (newList) => {
      // Instant UI update — new list appears immediately
      queryClient.setQueryData(userListQueryKeys.lists(), (old: UserListsResponse | undefined) =>
        old ? { ...old, lists: [...old.lists, newList] } : undefined
      )

      // Background revalidation for server consistency
      queryClient.invalidateQueries({ queryKey: userListQueryKeys.all })
    },

    // Show error toast on failure
    onError: () => {
      toast.error(t('createListError'))
    },
  })

  // Return the mutation
  return {
    createList: mutation.mutate,
    isPending: mutation.isPending,
  }
}
