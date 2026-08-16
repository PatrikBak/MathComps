import { useQueryClient } from '@tanstack/react-query'
import { useTranslations } from 'next-intl'
import { useCallback } from 'react'
import { toast } from 'sonner'

import { useOptimisticMutation } from '@/hooks/use-optimistic-mutation'
import { useProblemStore } from '@/stores/problem-store'

import { getListItemApiUrl } from '../services/user-list-api-urls'
import {
  applyProblemEdit,
  invalidateAffectedSearches,
  type ProblemEditContext,
  restoreSearches,
} from '../utils/problem-search-cache'
import { userListQueryKeys } from './use-user-lists'

/**
 * Parameters for the toggle list item mutation.
 */
type ToggleListItemParams = {
  /** The slug of the problem to add or remove */
  problemSlug: string
  /** The content ID of the target list */
  contentId: string
  /** Whether the problem is currently in the list (determines add vs remove) */
  isInList: boolean
}

/**
 * Hook to toggle a problem's membership in a user list.
 * Optimistically updates the problem store and invalidates caches on success.
 * Shows an undo toast when removing a problem while viewing that list.
 *
 * @returns A function to toggle list membership: `(problemSlug, contentId) => void`
 */
export function useToggleListItem() {
  // Translations for auth prompt and error/toast messages
  const t = useTranslations('problems')

  // Query client for cache invalidation
  const queryClient = useQueryClient()

  // Store action for optimistic updates
  const toggleListMembership = useProblemStore((state) => state.toggleListMembership)

  // Prepare the mutation
  const mutation = useOptimisticMutation<void, ToggleListItemParams, ProblemEditContext>({
    // Call the backend API — POST to add, DELETE to remove
    apiFn: (apiCall, { contentId, problemSlug, isInList }) =>
      apiCall<void>(() => getListItemApiUrl(contentId, problemSlug), {
        method: isInList ? 'DELETE' : 'POST',
      }),

    // The edit taken to the store and to every screen it stops the problem belonging on, before the
    // archive has been asked
    onMutate: ({ problemSlug, contentId }) =>
      applyProblemEdit(queryClient, problemSlug, () =>
        toggleListMembership(problemSlug, contentId)
      ),

    // Handle successful server response
    onSuccess: (_data, { problemSlug, contentId, isInList }, context) => {
      // Invalidate the lists cache (problem counts may have changed)
      queryClient.invalidateQueries({ queryKey: userListQueryKeys.all })

      // A search reading inside this list now answers differently, whichever screen the reader was
      // on when they edited it, so it may not go on serving what it holds
      invalidateAffectedSearches(
        queryClient,
        (searchFilters) => searchFilters?.listContentId === contentId
      )

      // Show undo toast when removing from a list while viewing it
      // (the problem just disappeared from the view, so undo is critical)
      if (isInList && context?.hasLeftView) {
        toast.info(t('removedFromList'), {
          action: {
            label: t('favorites.undo'),
            onClick: () => {
              // Re-call the mutation to undo the removal
              // isInList: false because the problem is currently not in the list
              mutation.mutate({ problemSlug, contentId, isInList: false })
            },
          },
        })
      }
    },

    // Rollback optimistic update on error
    onError: (_error, { problemSlug, contentId }, context) => {
      // Nothing was optimistically applied when the mutation never got as far as running
      if (!context) return

      // Rollback the list membership state
      toggleListMembership(problemSlug, contentId)

      // And put back every search the problem was taken out of
      restoreSearches(queryClient, context.hiddenFrom)
    },

    // Auth configuration
    authReason: t('addToListAuthReason'),

    // Error message for API failures
    errorMessage: t('addToListError'),
  })

  // Return a user-friendly function
  return useCallback(
    (problemSlug: string, contentId: string) => {
      // Look up the current list membership from the store
      const problem = useProblemStore.getState().problems[problemSlug]

      // If the problem exists in the store, call the mutation
      if (problem) {
        const isInList = problem.listContentIds.includes(contentId)
        mutation.mutate({ problemSlug, contentId, isInList })
      }
    },
    [mutation]
  )
}
