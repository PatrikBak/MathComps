import { useLocalStorage } from '@mantine/hooks'
import { useEffect } from 'react'

import { useApi } from '@/hooks/use-api'

/**
 * Configuration for restoring a pending like action.
 */
type UseRestorePendingLikeConfig<T> = {
  /** The local storage key to use for storing the pending ID/Slug */
  storageKey: string
  /**
   * Function to retrieve the item based on the stored ID.
   * Returns undefined if the item is not found (e.g. data not loaded yet).
   */
  getItem: (id: string) => T | undefined
  /**
   * Function to check if the action should be executed on the item.
   * Typically checks if the item is already liked to avoid accidental toggles.
   */
  shouldExecute: (item: T) => boolean
  /**
   * The action to execute (e.g. toggle like).
   */
  onExecute: (id: string) => void
  /**
   * Dependencies to check for readiness (e.g. data source).
   * The hook will only run when these are truthy.
   */
  dependencies?: unknown[]
}

/**
 * Generic hook to handle the pattern of:
 * 1. Storing an ID when unauthenticated
 * 2. Retrieving it after login
 * 3. Finding the corresponding object
 * 4. Performing an action (like)
 * 5. Clearing the storage
 */
export function useRestorePendingLike<T>({
  storageKey,
  getItem,
  shouldExecute,
  onExecute,
}: UseRestorePendingLikeConfig<T>) {
  // Access the pending ID from local storage
  const [pendingId, setPendingId] = useLocalStorage<string | null>({
    key: storageKey,
    defaultValue: null,
  })

  // We need the API client to check if it's ready (user is logged in)
  const api = useApi()

  useEffect(() => {
    // Only proceed if:
    // 1. The API client is ready (user is logged in)
    // 2. We have a pending ID
    if (api.state === 'ready' && pendingId) {
      // Try to find the item
      const item = getItem(pendingId)

      // If item is found (data is loaded)
      if (item) {
        // Check if we should execute the action (e.g. not already liked)
        if (shouldExecute(item)) {
          // If so, execute the action
          onExecute(pendingId)
        }

        // Always clear the pending ID once we've processed it (or attempted to)
        // This prevents infinite loops or stuck states
        setPendingId(null)
      }
    }
  }, [api.state, pendingId, setPendingId, getItem, shouldExecute, onExecute])
}
