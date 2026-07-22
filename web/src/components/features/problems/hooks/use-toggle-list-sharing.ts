import { useQueryClient } from '@tanstack/react-query'
import { useTranslations } from 'next-intl'

import { useOptimisticMutation } from '@/hooks/use-optimistic-mutation'

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
  // Query client for cache invalidation
  const queryClient = useQueryClient()

  // Translations for error and auth-prompt messages
  const t = useTranslations('problems.filters')

  // Toggle sharing mutation
  const mutation = useOptimisticMutation<void, ToggleListSharingArgs>({
    // POST to enable, DELETE to disable
    apiFn: (apiCall, { contentId, enabled }) =>
      apiCall<void>(() => getListShareApiUrl(contentId), { method: enabled ? 'POST' : 'DELETE' }),

    // Refetch lists so the isShared flag updates in the UI
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: userListQueryKeys.all })
    },

    // The reason shown in the auth prompt
    authReason: t('authReasons.manageLists'),

    // Fallback copy when the failure carried no recognized code
    errorMessage: t('shareListError'),
  })

  // Return the mutation
  return {
    toggleSharing: mutation.mutateAsync,
    isPending: mutation.isPending,
  }
}
