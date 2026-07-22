import { useQueryClient } from '@tanstack/react-query'
import { useTranslations } from 'next-intl'

import { useOptimisticMutation } from '@/hooks/use-optimistic-mutation'

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
  // Query client for cache invalidation
  const queryClient = useQueryClient()

  // Translations for error and auth-prompt messages
  const t = useTranslations('problems.filters')

  // Rename mutation
  const mutation = useOptimisticMutation<void, RenameUserListArgs>({
    // Call the rename endpoint
    apiFn: (apiCall, { contentId, name }) =>
      apiCall<void>(() => getListApiUrl(contentId), {
        method: 'PATCH',
        body: JSON.stringify({ name }),
        headers: { 'Content-Type': 'application/json' },
      }),

    // Refetch lists so the renamed list appears with the new name
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: userListQueryKeys.all })
    },

    // The reason shown in the auth prompt
    authReason: t('authReasons.manageLists'),

    // Fallback copy when the failure carried no recognized code
    errorMessage: t('renameListError'),
  })

  // Return the mutation
  return {
    renameList: mutation.mutateAsync,
    isPending: mutation.isPending,
  }
}
