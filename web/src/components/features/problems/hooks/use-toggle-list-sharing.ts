import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useTranslations } from 'next-intl'
import { toast } from 'sonner'

import { useApi } from '@/hooks/use-api'

import { getListShareApiUrl } from '../services/user-list-api-urls'
import { userListQueryKeys } from './use-user-lists'

/**
 * Return type for {@link useToggleListSharing}.
 */
type UseToggleListSharingResult = {
  /** Call to enable or disable sharing for a list */
  toggleSharing: (args: ToggleListSharingArgs) => Promise<void>
  /** Whether the mutation is currently in progress */
  isPending: boolean
}

/**
 * Arguments for the toggle sharing mutation.
 */
type ToggleListSharingArgs = {
  /** The content ID of the list */
  contentId: string
  /** Whether to enable (true) or disable (false) sharing */
  enabled: boolean
}

/**
 * Hook to enable or disable public sharing for a user list.
 * Uses POST to enable and DELETE to disable. Invalidates the lists cache on success.
 *
 * @returns Mutation function and pending state
 */
export function useToggleListSharing(): UseToggleListSharingResult {
  // API client — requires auth
  const api = useApi({ requireAuth: true })

  // Query client for cache invalidation
  const queryClient = useQueryClient()

  // Translations for error messages
  const t = useTranslations('problems.filters')

  // Toggle sharing mutation
  const mutation = useMutation({
    mutationFn: async ({ contentId, enabled }: ToggleListSharingArgs) => {
      // Ensure the API client is ready (user is authenticated)
      if (api.state !== 'ready') throw new Error('API not ready')

      // POST to enable, DELETE to disable
      const response = await api.apiCall(() => getListShareApiUrl(contentId), {
        method: enabled ? 'POST' : 'DELETE',
      })

      // Rethrow so React Query can handle retries
      if (!response.success) throw response.error
    },

    // Refetch lists so the isShared flag updates in the UI
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: userListQueryKeys.all })
    },

    // Show error toast on failure
    onError: () => {
      toast.error(t('shareListError'))
    },
  })

  // Return the mutation
  return {
    toggleSharing: mutation.mutateAsync,
    isPending: mutation.isPending,
  }
}
