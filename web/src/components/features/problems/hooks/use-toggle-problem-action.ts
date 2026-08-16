import { useLocalStorage } from '@mantine/hooks'
import { useQueryClient } from '@tanstack/react-query'
import { useCallback } from 'react'
import { toast } from 'sonner'

import type { ApiCaller } from '@/hooks/use-api'
import { useOptimisticMutation } from '@/hooks/use-optimistic-mutation'
import { useProblemStore } from '@/stores/problem-store'
import type { ApiResult } from '@/types/api'

import {
  applyProblemEdit,
  invalidateAffectedSearches,
  type ProblemEditContext,
  restoreSearches,
} from '../utils/problem-search-cache'
import { filtersOnState, type ReaderState } from '../utils/problem-view-membership'
import { userListQueryKeys } from './use-user-lists'

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
  /** What the toggle moves, which is both what it reads off a problem and what a screen can filter by */
  toggles: ReaderState
  /** Whether the counts the reader's own lists are drawn with move with it */
  movesListCounts: boolean
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
  const [, setPendingSlug] = useLocalStorage<string | null>({
    key: config.pendingStorageKey,
    defaultValue: null,
  })

  // Prepare the mutation
  const mutation = useOptimisticMutation<void, ToggleProblemActionParams, ProblemEditContext>({
    // Call the backend API
    apiFn: (apiCall, { problemSlug }) => config.apiFn(apiCall, problemSlug),

    // The toggle taken to the store and to every screen it stops the problem belonging on, before
    // the archive has been asked
    onMutate: ({ problemSlug }) =>
      applyProblemEdit(queryClient, problemSlug, () => config.toggleInStore(problemSlug)),

    // After successful server call
    onSuccess: (_data, { problemSlug, isActive }, context) => {
      // Every search narrowed by what just changed now answers differently, whichever screen the
      // reader was on when they changed it, so none of them may go on serving what it holds
      invalidateAffectedSearches(queryClient, (searchFilters) =>
        filtersOnState(searchFilters, config.toggles)
      )

      // The reader's own lists are counted by the archive, so a toggle that moves one of those counts
      // leaves every number the lists are drawn with a problem behind
      if (config.movesListCounts) {
        queryClient.invalidateQueries({ queryKey: userListQueryKeys.all })
      }

      // Show undo toast only when the item leaves the filtered view
      if (context?.hasLeftView) {
        toast.info(config.messages.removedMessage, {
          action: {
            label: config.messages.undoLabel,
            onClick: () => {
              // Pass the current (toggled) state so the mutation knows the direction
              mutation.mutate({ problemSlug, isActive: !isActive })
            },
          },
        })
      }
    },

    // Rollback on failure
    onError: (_error, { problemSlug }, context) => {
      // Nothing was optimistically applied when the mutation never got as far as running
      if (!context) return

      // Rollback the state in the store
      config.toggleInStore(problemSlug)

      // And put back every search the problem was taken out of
      restoreSearches(queryClient, context.hiddenFrom)
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
          isActive: problem[config.toggles],
        })
      }
    },
    [mutation, config.toggles]
  )
}
