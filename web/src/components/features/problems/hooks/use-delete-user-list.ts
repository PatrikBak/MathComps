import { useQueryClient } from '@tanstack/react-query'
import { useTranslations } from 'next-intl'

import { useOptimisticMutation } from '@/hooks/use-optimistic-mutation'

import { getListApiUrl } from '../services/user-list-api-urls'
import { userListQueryKeys } from './use-user-lists'

/**
 * Return type for {@link useDeleteUserList}.
 */
type UseDeleteUserListResult = {
  /** Call to delete a list by its contentId */
  deleteList: (contentId: string) => void
  /** Whether the mutation is currently in progress */
  isPending: boolean
}

/**
 * Hook to delete a user list. Invalidates the lists cache on success.
 *
 * @returns Mutation function and pending state
 */
export function useDeleteUserList(): UseDeleteUserListResult {
  // Query client for cache invalidation
  const queryClient = useQueryClient()

  // Translations for error and auth-prompt messages
  const t = useTranslations('problems.filters')

  // Delete mutation
  const mutation = useOptimisticMutation<void, string>({
    // Call the delete endpoint
    apiFn: (apiCall, contentId) =>
      apiCall<void>(() => getListApiUrl(contentId), { method: 'DELETE' }),

    // Refetch lists so the deleted list disappears
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: userListQueryKeys.all })
    },

    // The reason shown in the auth prompt
    authReason: t('authReasons.manageLists'),

    // Fallback copy when the failure carried no recognized code
    errorMessage: t('deleteListError'),
  })

  // Return the mutation
  return {
    deleteList: mutation.mutate,
    isPending: mutation.isPending,
  }
}
