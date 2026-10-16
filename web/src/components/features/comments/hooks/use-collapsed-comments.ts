'use client'

import { useCallback, useState } from 'react'

import { toggleSetItem } from '@/components/shared/utils/collection-utils'

/**
 * What {@link useCollapsedComments} hands back.
 */
export type UseCollapsedCommentsResult = {
  /** Whether a comment's replies are folded away. */
  isCollapsed: (commentId: string) => boolean
  /** Folds a comment's replies away, or opens them back up. */
  toggle: (commentId: string) => void
}

/**
 * Which comments have their replies folded away, every one open at first.
 *
 * @returns Whether each comment is folded, and the way to fold or open one.
 */
export function useCollapsedComments(): UseCollapsedCommentsResult {
  // The comments whose replies are folded away
  const [collapsedIds, setCollapsedIds] = useState<Set<string>>(new Set())

  // A function which says whether a comment's replies are folded away
  const isCollapsed = useCallback(
    (commentId: string) => collapsedIds.has(commentId),
    [collapsedIds]
  )

  // A function which folds a comment's replies away, or opens them back up
  const toggle = useCallback(
    (commentId: string) => setCollapsedIds((previous) => toggleSetItem(previous, commentId)),
    []
  )

  // Whether each comment is folded, and the way to fold or open one
  return { isCollapsed, toggle }
}
