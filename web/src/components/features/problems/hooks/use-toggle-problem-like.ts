import { useLocalStorage } from '@mantine/hooks'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useCallback } from 'react'
import { toast } from 'sonner'

import { PENDING_PROBLEM_LIKE_STORAGE_KEY } from '@/constants/local-storage-constants'
import { useLoginPromptToast } from '@/hooks/use-login-prompt-toast'
import { useApi } from '@/hooks/useApi'
import { useProblemStore } from '@/stores/problem-store'

import { toggleProblemLike } from '../services/problem-service'
import { problemQueryKeys } from './use-problem-search-query'

/**
 * Result type for the toggle problem like mutation
 */
type ToggleProblemLikeResult =
  | { type: 'success' }
  | { type: 'authenticationLoading' }
  | { type: 'unauthenticated' }

/**
 * Hook to toggle likes on problems
 */
export function useToggleProblemLike() {
  // After liking a problem, we need to update potential cached queries
  // to reflect the searched for liked-only problems
  const queryClient = useQueryClient()

  // Function to toggle likes in the global store
  const toggleProblemLikeInStore = useProblemStore((state) => state.toggleProblemLike)

  // Get current filters to check if we're viewing favorites only
  const currentFilters = useProblemStore((state) => state.currentFilters)

  // API client for liking problems
  const api = useApi()

  // Local storage for pending like slugs
  // (used to remember the like action for the case where a user previouly
  // not logged in liked the problem and then clicked on the login button in the toast,
  // this way we can apply the like action once the user logs in)
  const [_, setPendingLikeSlug] = useLocalStorage<string | null>({
    key: PENDING_PROBLEM_LIKE_STORAGE_KEY,
    defaultValue: null,
  })

  // Function to show login prompt toast
  const showLoginPrompt = useLoginPromptToast()

  /**
   * Parameters for the toggle problem like mutation
   */
  type ToggleProblemLikeParams = {
    /** The slug of the problem to like */
    problemSlug: string
    /** Whether the problem is liked or not */
    isLiked: boolean
  }

  // Prepare the mutation to toggle likes
  const mutate = useMutation({
    mutationFn: async ({
      problemSlug,
    }: ToggleProblemLikeParams): Promise<ToggleProblemLikeResult> => {
      // Handle different authentication states
      switch (api.state) {
        // Still loading Clerk's data...have not seen this triggered yet mhm
        case 'loading':
          toast.loading('Overujem prihlásenie')
          return { type: 'authenticationLoading' }

        // User is not signed in
        case 'unauthenticated':
          // Ensure we remember they liked the problem so we can apply it after login
          setPendingLikeSlug(problemSlug)

          // Show a toast notification to prompt the user to log in
          showLoginPrompt({
            reason: 'lajkovanie úloh',
            // Clear the pending like slug when the toast is dismissed
            // (so that a user is not surprised to have liked a problem after a while)
            onDismiss: () => {
              setPendingLikeSlug(null)
            },
          })

          // Return the reason for the unauthenticated state
          return { type: 'unauthenticated' }

        // User is signed in
        case 'ready':
          // Call the backend API to toggle the like
          const result = await toggleProblemLike(api.apiCall, problemSlug)

          // If the API call fails, throw an error so that onError can handle it
          if (!result.isSuccess) {
            throw result.error
          }

          // Otherwise the API call was successful
          return { type: 'success' }
      }
    },

    // The function called before the server call happens
    onMutate: async ({ problemSlug: updatedProblemSlug }) => {
      // Save the previous state for rollback
      const previousDisplayedProblems = useProblemStore.getState().displayedProblems

      // Update the global state of the problem
      toggleProblemLikeInStore(updatedProblemSlug)

      // Return context with previous state for potential rollback
      return { previousDisplayedProblems }
    },

    // The function called after a non-errorish server call
    onSuccess: (result, { problemSlug, isLiked }, { previousDisplayedProblems }) => {
      // Handle different authentication states
      switch (result.type) {
        // Unhappy paths
        case 'authenticationLoading':
        case 'unauthenticated':
          // Rollback the like state in the store
          toggleProblemLikeInStore(problemSlug)

          // Restore the original displayed problems list
          useProblemStore.getState().setDisplayedProblems(previousDisplayedProblems)
          break

        // Happy path
        case 'success':
          // Invalidate the favorites query to refetch when filtering by liked problems
          queryClient.invalidateQueries({
            queryKey: problemQueryKeys.favorites,
          })

          // Show undo toast only when:
          // 1. We unliked a problem (not liked)
          // 2. AND we're currently viewing favorites only
          // This makes sense because the problem just disappeared from the view
          // In other contexts, the problem stays visible so undo is less critical
          if (!isLiked && currentFilters?.favoritesOnly) {
            toast.info('Úloha bola odstránená z obľúbených', {
              action: {
                label: 'Vrátiť',
                onClick: () => {
                  // Re-call the mutation with isLiked: true to undo the unlike
                  // This reuses all the logic: optimistic updates, error handling, etc.
                  mutate({ problemSlug, isLiked: true })
                },
              },
            })
          }
          break
      }
    },

    // The function called after the server throws an error
    onError: (_, { problemSlug }, context) => {
      // Rollback the like state in the store
      toggleProblemLikeInStore(problemSlug)

      // Restore the original displayed problems list
      if (context?.previousDisplayedProblems) {
        useProblemStore.getState().setDisplayedProblems(context.previousDisplayedProblems)
      }

      // Show error toast for actual API errors
      toast.error('Nepodarilo sa zmeniť stav lajku')
    },
  }).mutate

  // Return a user-friendly function to toggle likes
  return useCallback(
    (problemSlug: string) => {
      // Look up the current like state from the store
      const problem = useProblemStore.getState().problems[problemSlug]

      // If the problem is found, i.e. it is in the store, toggle the like state
      if (problem) {
        toggleProblemLikeInStore(problemSlug)
      }
    },
    [toggleProblemLikeInStore]
  )
}
