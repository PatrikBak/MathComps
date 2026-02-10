import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useTranslations } from 'next-intl'
import { toast } from 'sonner'

import { useApi } from '@/hooks/use-api'

import { getListApiUrl } from '../services/user-list-api-urls'
import { userListQueryKeys } from './use-user-lists'

/**
 * Return type for {@link useRenameUserList}.
 */
type UseRenameUserListResult = {
  /** Call to rename a list */
  renameList: (args: RenameUserListArgs) => Promise<void>
  /** Whether the mutation is currently in progress */
  isPending: boolean
}

/**
 * Arguments for the rename mutation.
 */
type RenameUserListArgs = {
  /** The content ID of the list to rename */
  contentId: string
  /** The new name for the list */
  name: string
}

/**
 * Hook to rename a user list. Invalidates the lists cache on success.
 *
 * @returns Mutation function and pending state
 */
export function useRenameUserList(): UseRenameUserListResult {
  // API client — requires auth
  const api = useApi({ requireAuth: true })

  // Query client for cache invalidation
  const queryClient = useQueryClient()

  // Translations for error messages
  const t = useTranslations('problems.filters')

  // Rename mutation
  const mutation = useMutation({
    mutationFn: async ({ contentId, name }: RenameUserListArgs) => {
      // Ensure the API client is ready (user is authenticated)
      if (api.state !== 'ready') throw new Error('API not ready')

      // Call the rename endpoint
      const response = await api.apiCall(() => getListApiUrl(contentId), {
        method: 'PATCH',
        body: JSON.stringify({ name }),
        headers: { 'Content-Type': 'application/json' },
      })

      // Rethrow so React Query can handle retries
      if (!response.success) throw response.error
    },

    // Refetch lists so the renamed list appears with the new name
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: userListQueryKeys.all })
    },

    // Show error toast on failure
    onError: () => {
      toast.error(t('renameListError'))
    },
  })

  // Return the mutation
  return {
    renameList: mutation.mutateAsync,
    isPending: mutation.isPending,
  }
}
