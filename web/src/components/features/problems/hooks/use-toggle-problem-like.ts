import { useLocalStorage } from '@mantine/hooks'
import { useQueryClient } from '@tanstack/react-query'
import { useTranslations } from 'next-intl'
import { useCallback } from 'react'
import { toast } from 'sonner'

import { PENDING_PROBLEM_LIKE_STORAGE_KEY } from '@/constants/local-storage-constants'
import { useOptimisticMutation } from '@/hooks/use-optimistic-mutation'
import { useProblemStore } from '@/stores/problem-store'

import { toggleProblemLike } from '../services/problem-service'
import { problemQueryKeys } from './use-problem-search-query'

/**
 * Parameters for the toggle problem like mutation
 */
type ToggleProblemLikeParams = {
  /** The slug of the problem to like */
  problemSlug: string
  /** Whether the problem is liked or not */
  isLiked: boolean
}

/**
 * Context for the toggle problem like mutation - stores state for rollback
 */
type ToggleProblemLikeContext = {
  /** The previous displayed problem slugs before optimistic update */
  previousDisplayedProblems: string[]
}

/**
 * Hook to toggle likes on problems
 */
export function useToggleProblemLike() {
  // Get the translations
  const t = useTranslations('problems.favorites')

  // After liking a problem, we need to update potential cached queries
  // to reflect the searched for liked-only problems
  const queryClient = useQueryClient()

  // Function to toggle likes in the global store
  const toggleProblemLikeInStore = useProblemStore((state) => state.toggleProblemLike)

  // Get current filters to check if we're viewing favorites only
  const currentFilters = useProblemStore((state) => state.currentFilters)

  // Local storage for pending like slugs
  // (used to remember the like action for the case where a user previouly
  // not logged in liked the problem and then clicked on the login button in the toast,
  // this way we can apply the like action once the user logs in)
  const [_, setPendingLikeSlug] = useLocalStorage<string | null>({
    key: PENDING_PROBLEM_LIKE_STORAGE_KEY,
    defaultValue: null,
  })

  // Prepare the mutation to toggle likes
  const mutation = useOptimisticMutation<void, ToggleProblemLikeParams, ToggleProblemLikeContext>({
    // Call the backend API to toggle the like
    apiFn: (apiCall, { problemSlug }) => toggleProblemLike(apiCall, problemSlug),

    // The function called before the server call happens
    onMutate: ({ problemSlug: updatedProblemSlug }) => {
      // Save the previous state for rollback
      const previousDisplayedProblems = useProblemStore.getState().displayedProblems

      // Update the global state of the problem
      toggleProblemLikeInStore(updatedProblemSlug)

      // Return context with previous state for potential rollback
      return { previousDisplayedProblems }
    },

    // The function called after a successful server call
    onSuccess: (_, { problemSlug, isLiked }) => {
      // Invalidate the favorites query to refetch when filtering by liked problems
      queryClient.invalidateQueries({
        queryKey: problemQueryKeys.favorites,
      })

      // Show undo toast only when:
      // 1. We unliked a problem (isLiked was true before the toggle)
      // 2. AND we're currently viewing favorites only
      // This makes sense because the problem just disappeared from the view
      // In other contexts, the problem stays visible so undo is less critical
      if (isLiked && currentFilters?.favoritesOnly) {
        toast.info(t('removedFromFavorites'), {
          action: {
            label: t('undo'),
            onClick: () => {
              // Re-call the mutation to undo the unlike
              // isLiked: false because the problem is currently unliked (before this re-like toggle)
              // This reuses all the logic: optimistic updates, error handling, etc.
              mutation.mutate({ problemSlug, isLiked: false })
            },
          },
        })
      }
    },

    // The function called after the mutation fails (or auth fails)
    onError: (_, { problemSlug }, context) => {
      // Rollback the like state in the store only if we optimistically updated it
      if (context) {
        toggleProblemLikeInStore(problemSlug)
      }

      // Restore the original displayed problems list
      if (context?.previousDisplayedProblems) {
        useProblemStore.getState().setDisplayedProblems(context.previousDisplayedProblems)
      }
    },

    // Auth configuration
    authReason: t('authReason'),

    // Ensure we remember they liked the problem so we can apply it after login
    onBeforeLoginPrompt: ({ problemSlug }) => {
      setPendingLikeSlug(problemSlug)
    },

    // Clear the pending like slug when the toast is dismissed
    // (so that a user is not surprised to have liked a problem after a while)
    onLoginPromptDismiss: () => {
      setPendingLikeSlug(null)
    },

    // Error message for actual API errors
    errorMessage: t('likeToggleFailed'),
  })

  // Return a user-friendly function to toggle likes
  return useCallback(
    (problemSlug: string) => {
      // Look up the current like state from the store
      const problem = useProblemStore.getState().problems[problemSlug]

      // If the problem is found, i.e. it is in the store, call the mutation
      // which will handle authentication checks and API calls
      if (problem) {
        mutation.mutate({ problemSlug, isLiked: problem.liked })
      }
    },
    [mutation]
  )
}
