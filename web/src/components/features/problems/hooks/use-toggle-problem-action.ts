import { useLocalStorage } from '@mantine/hooks'
import { useQueryClient } from '@tanstack/react-query'
import { useCallback } from 'react'
import { toast } from 'sonner'

import type { ApiCaller } from '@/hooks/use-api'
import { useOptimisticMutation } from '@/hooks/use-optimistic-mutation'
import { useProblemStore } from '@/stores/problem-store'
import type { ApiResult } from '@/types/api'

import type { Problem } from '../types/problem-api-types'

/**
 * Pre-resolved i18n strings for the toggle action.
 * Callers use `useTranslations` with their own namespace and pass the resolved strings here.
 */
type ToggleActionMessages = {
  /** Message shown as auth reason when user is not logged in */
  authReason: string
  /** Toast message shown when removing from a filtered view */
  removedMessage: string
  /** Label for the undo button in the toast */
  undoLabel: string
  /** Error message shown when the API call fails */
  errorMessage: string
}

/**
 * Configuration for creating a problem toggle action (like, mark, etc.)
 */
type ToggleProblemActionConfig = {
  /** API function to call (e.g. toggleProblemLike, toggleProblemMark) */
  apiFn: (apiCall: ApiCaller, slug: string) => Promise<ApiResult<void>>
  /** Store action for optimistic toggle */
  toggleInStore: (slug: string) => void
  /** Property on Problem to read current state (e.g. 'liked', 'marked') */
  stateKey: keyof Problem
  /** Whether the current view filters by this action (triggers undo toast + display filtering) */
  isFilteredView: () => boolean
  /** React Query keys to invalidate on success */
  invalidateQueryKeys: readonly unknown[]
  /** localStorage key for pending action */
  pendingStorageKey: string
  /** Pre-resolved i18n strings */
  messages: ToggleActionMessages
}

/**
 * Parameters for the toggle mutation
 */
type ToggleProblemActionParams = {
  /** The slug of the problem */
  problemSlug: string
  /** The current state before toggling */
  isActive: boolean
}

/**
 * Context for rollback on mutation failure
 */
type ToggleProblemActionContext = {
  /** The previous displayed problem slugs before optimistic update */
  previousDisplayedProblems: string[]
}

/**
 * Generic hook for toggling a boolean action on a problem (like, mark, etc.)
 *
 * Handles:
 * - Optimistic updates via the store
 * - Undo toast when removing from a filtered view
 * - Pending action via localStorage for post-login restoration
 * - Auth-gated mutation with login prompt
 *
 * @param config - Configuration for the toggle action
 *
 * @returns A function that toggles the action on a problem by slug
 */
export function useToggleProblemAction(config: ToggleProblemActionConfig) {
  // After toggling, we need to update potential cached queries
  const queryClient = useQueryClient()

  // Local storage for pending action slugs
  const [_, setPendingSlug] = useLocalStorage<string | null>({
    key: config.pendingStorageKey,
    defaultValue: null,
  })

  // Prepare the mutation
  const mutation = useOptimisticMutation<
    void,
    ToggleProblemActionParams,
    ToggleProblemActionContext
  >({
    // Call the backend API
    apiFn: (apiCall, { problemSlug }) => config.apiFn(apiCall, problemSlug),

    // Optimistic update before server call
    onMutate: ({ problemSlug: updatedProblemSlug }) => {
      // Save the previous state for rollback
      const previousDisplayedProblems = useProblemStore.getState().displayedProblems

      // Update the global state
      config.toggleInStore(updatedProblemSlug)

      // Return context with previous state for potential rollback
      return { previousDisplayedProblems }
    },

    // After successful server call
    onSuccess: (_, { problemSlug, isActive }) => {
      // Invalidate related queries to refetch
      queryClient.invalidateQueries({
        queryKey: config.invalidateQueryKeys,
      })

      // Show undo toast only when:
      // 1. We deactivated (isActive was true before the toggle)
      // 2. AND we're currently in a filtered view for this action
      // This makes sense because the item just disappeared from the view
      if (isActive && config.isFilteredView()) {
        toast.info(config.messages.removedMessage, {
          action: {
            label: config.messages.undoLabel,
            onClick: () => {
              // Re-call the mutation to undo
              mutation.mutate({ problemSlug, isActive: false })
            },
          },
        })
      }
    },

    // Rollback on failure
    onError: (_, { problemSlug }, context) => {
      // Rollback the state in the store
      if (context) {
        config.toggleInStore(problemSlug)
      }

      // Restore the original displayed problems list
      if (context?.previousDisplayedProblems) {
        useProblemStore.getState().setDisplayedProblems(context.previousDisplayedProblems)
      }
    },

    // Auth configuration
    authReason: config.messages.authReason,

    // Remember the pending action for post-login restoration
    onBeforeLoginPrompt: ({ problemSlug }) => {
      setPendingSlug(problemSlug)
    },

    // Clear the pending slug when the toast is dismissed
    onLoginPromptDismiss: () => {
      setPendingSlug(null)
    },

    // Error message for actual API errors
    errorMessage: config.messages.errorMessage,
  })

  // Return a user-friendly function to toggle the action
  return useCallback(
    (problemSlug: string) => {
      // Look up the current state from the store
      const problem = useProblemStore.getState().problems[problemSlug]

      // If the problem is found, call the mutation
      if (problem) {
        mutation.mutate({
          problemSlug,
          isActive: problem[config.stateKey] as boolean,
        })
      }
    },
    [mutation, config.stateKey]
  )
}
