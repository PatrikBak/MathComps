import { useQueryClient } from '@tanstack/react-query'
import { useTranslations } from 'next-intl'

import { useOptimisticMutation } from '@/hooks/use-optimistic-mutation'

import { getUserListsApiUrl } from '../services/user-list-api-urls'
import type { UserListDto, UserListsResponse } from '../types/user-list-types'
import { userListQueryKeys, useUserListsKey } from './use-user-lists'

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
  // Query client for cache invalidation
  const queryClient = useQueryClient()

  // Translations for error and auth-prompt messages
  const t = useTranslations('problems.filters')

  // Where this user's lists are cached
  const listsKey = useUserListsKey()

  // Create list mutation
  const mutation = useOptimisticMutation<UserListDto, string>({
    // Call the create endpoint
    apiFn: (apiCall, name) =>
      apiCall<UserListDto>(() => getUserListsApiUrl(), {
        method: 'POST',
        body: JSON.stringify({ name }),
        headers: { 'Content-Type': 'application/json' },
      }),

    // Optimistically append the new list to the cache, then revalidate
    onSuccess: (newList) => {
      // Instant UI update — new list appears immediately
      queryClient.setQueryData(listsKey, (old: UserListsResponse | undefined) =>
        old ? { ...old, lists: [...old.lists, newList] } : undefined
      )

      // Background revalidation for server consistency
      queryClient.invalidateQueries({ queryKey: userListQueryKeys.all })
    },

    // The reason shown in the auth prompt
    authReason: t('authReasons.manageLists'),

    // Fallback copy when the failure carried no recognized code
    errorMessage: t('createListError'),
  })

  // Return the mutation
  return {
    createList: mutation.mutate,
    isPending: mutation.isPending,
  }
}
