import { useQueryClient } from '@tanstack/react-query'
import { useTranslations } from 'next-intl'
import { useCallback } from 'react'
import { toast } from 'sonner'

import { useOptimisticMutation } from '@/hooks/use-optimistic-mutation'
import { useProblemStore } from '@/stores/problem-store'

import { getListItemApiUrl } from '../services/user-list-api-urls'
import { problemQueryKeys } from './use-problem-search-query'
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
 * Context for rollback on error.
 */
type ToggleListItemContext = {
  /** The displayed problem slugs before optimistic update */
  previousDisplayedProblems: string[]
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

  // Current filters to check if we're viewing a specific list
  const currentFilters = useProblemStore((state) => state.currentFilters)

  // Prepare the mutation
  const mutation = useOptimisticMutation<void, ToggleListItemParams, ToggleListItemContext>({
    // Call the backend API — POST to add, DELETE to remove
    apiFn: (apiCall, { contentId, problemSlug, isInList }) =>
      apiCall<void>(() => getListItemApiUrl(contentId, problemSlug), {
        method: isInList ? 'DELETE' : 'POST',
      }),

    // Optimistically update the store before the server responds
    onMutate: ({ problemSlug, contentId }) => {
      // Save previous state for rollback
      const previousDisplayedProblems = useProblemStore.getState().displayedProblems

      // Toggle the list membership in the store
      toggleListMembership(problemSlug, contentId)

      // Return context for potential rollback
      return { previousDisplayedProblems }
    },

    // Handle successful server response
    onSuccess: (_, { problemSlug, contentId, isInList }) => {
      // Invalidate the lists cache (problem counts may have changed)
      queryClient.invalidateQueries({ queryKey: userListQueryKeys.all })

      // Invalidate all problem search results (list contents may have changed)
      queryClient.invalidateQueries({ queryKey: problemQueryKeys.all })

      // Show undo toast when removing from a list while viewing it
      // (the problem just disappeared from the view, so undo is critical)
      if (isInList && currentFilters?.listContentId === contentId) {
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
    onError: (_, { problemSlug, contentId }, context) => {
      // Rollback the list membership state
      if (context) {
        toggleListMembership(problemSlug, contentId)
      }

      // Restore the original displayed problems list
      if (context?.previousDisplayedProblems) {
        useProblemStore.getState().setDisplayedProblems(context.previousDisplayedProblems)
      }
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
