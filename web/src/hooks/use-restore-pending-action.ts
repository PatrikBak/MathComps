import { useLocalStorage } from '@mantine/hooks'
import { useEffect } from 'react'

import { useApi } from '@/hooks/use-api'

/**
 * Configuration for restoring a pending action.
 *
 * @template T - The item the action is done to.
 * @template TPending - What is stored about the action, the item's ID/Slug unless it needs more.
 */
type UseRestorePendingActionConfig<T, TPending> = {
  /** The local storage key to use for storing the pending action */
  storageKey: string
  /**
   * Function to retrieve the item the stored action is done to.
   * Returns undefined if the item is not found (e.g. data not loaded yet).
   */
  getItem: (pending: TPending) => T | undefined
  /**
   * Function to check if the action should be executed on the item.
   * Typically checks if the item is already in the desired state to avoid accidental toggles.
   */
  shouldExecute: (item: T, pending: TPending) => boolean
  /**
   * The action to execute (e.g. toggle like, toggle mark).
   */
  onExecute: (pending: TPending) => void
}

/**
 * Generic hook to handle the pattern of:
 * 1. Storing an action when unauthenticated
 * 2. Retrieving it after login
 * 3. Finding the corresponding object
 * 4. Performing an action (like, mark, etc.)
 * 5. Clearing the storage
 */
export function useRestorePendingAction<T, TPending = string>({
  storageKey,
  getItem,
  shouldExecute,
  onExecute,
}: UseRestorePendingActionConfig<T, TPending>) {
  // Access the pending action from local storage
  const [pending, setPending] = useLocalStorage<TPending | null>({
    key: storageKey,
    defaultValue: null,
  })

  // We need the API client to check if it's ready (user is logged in)
  const api = useApi()

  // Once the reader is signed in and the item is found, carry out the pending action and clear it from storage
  useEffect(() => {
    // Only once the API client is ready (the reader is signed in) and an action is pending
    if (api.state === 'ready' && pending) {
      // Try to find the item
      const item = getItem(pending)

      // If item is found (data is loaded)
      if (item) {
        // Check if we should execute the action (e.g. not already liked/marked)
        if (shouldExecute(item, pending)) {
          // If so, execute the action
          onExecute(pending)
        }

        // Always clear the pending action once we've processed it (or attempted to)
        // This prevents infinite loops or stuck states
        setPending(null)
      }
    }
  }, [api.state, pending, setPending, getItem, shouldExecute, onExecute])
}
