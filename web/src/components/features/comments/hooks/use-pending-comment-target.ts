import { useLocalStorage } from '@mantine/hooks'
import { useCallback } from 'react'

import { PENDING_COMMENT_TARGET_STORAGE_KEY } from '@/constants/local-storage-constants'

import type { CommentTarget } from '../services/comment-api-types'

/**
 * The return type of the {@link usePendingCommentTarget} hook.
 */
type PendingCommentTargetResult = {
  /** The current pending comment */
  pendingTarget: CommentTarget | null
  /** Saves the pending comment target */
  savePendingTarget: (target: CommentTarget) => void
  /** Clears the pending comment target */
  clearPendingTarget: () => void
}

/**
 * Hook to manage the pending comment target state in localStorage.
 * This is used to persist the intention to comment on a specific target
 * across login redirects.
 */
export function usePendingCommentTarget(): PendingCommentTargetResult {
  // Get the local storage value + update function
  const [pendingTarget, setPendingTarget] = useLocalStorage<CommentTarget | null>({
    key: PENDING_COMMENT_TARGET_STORAGE_KEY,
    defaultValue: null,
  })

  /**
   * A function to clear the pending target from storage.
   */
  const clearPendingTarget = useCallback(() => {
    setPendingTarget(null)
  }, [setPendingTarget])

  /**
   * A cuntion to save the pending target.
   */
  const savePendingTarget = useCallback(
    (target: CommentTarget) => {
      setPendingTarget(target)
    },
    [setPendingTarget]
  )

  // Return the current value + functions to update it
  return {
    pendingTarget,
    savePendingTarget,
    clearPendingTarget,
  }
}
