import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useTranslations } from 'next-intl'
import { toast } from 'sonner'

import { useApi } from '@/hooks/use-api'

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
  // API client — requires auth
  const api = useApi({ requireAuth: true })

  // Query client for cache invalidation
  const queryClient = useQueryClient()

  // Translations for error messages
  const t = useTranslations('problems.filters')

  // Delete mutation
  const mutation = useMutation({
    mutationFn: async (contentId: string) => {
      // Ensure the API client is ready (user is authenticated)
      if (api.state !== 'ready') throw new Error('API not ready')

      // Call the delete endpoint
      const response = await api.apiCall(() => getListApiUrl(contentId), {
        method: 'DELETE',
      })

      // Rethrow so React Query can handle retries
      if (!response.success) throw response.error
    },

    // Refetch lists so the deleted list disappears
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: userListQueryKeys.all })
    },

    // Show error toast on failure
    onError: () => {
      toast.error(t('deleteListError'))
    },
  })

  // Return the mutation
  return {
    deleteList: mutation.mutate,
    isPending: mutation.isPending,
  }
}
