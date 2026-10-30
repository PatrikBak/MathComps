'use client'

import { useCallback, useState } from 'react'

import { toggleSetItem } from '@/components/shared/utils/collection-utils'

import type { CommentData } from '../components/CommentItem'
import { commentKeyOf } from '../utils/comment-utils'

/**
 * What {@link useCollapsedComments} hands back.
 */
export type UseCollapsedCommentsResult = {
  /** Whether a comment's replies are folded away. */
  isCollapsed: (comment: CommentData) => boolean
  /** Folds a comment's replies away, or opens them back up. */
  toggle: (comment: CommentData) => void
}

/**
 * Which comments have their replies folded away, every one open at first. A comment stays folded through its edits,
 * which save it under a new id.
 *
 * @returns Whether each comment is folded, and the way to fold or open one.
 */
export function useCollapsedComments(): UseCollapsedCommentsResult {
  // The keys of the comments whose replies are folded away
  const [collapsedKeys, setCollapsedKeys] = useState<Set<string>>(new Set())

  // A function which says whether a comment's replies are folded away
  const isCollapsed = useCallback(
    (comment: CommentData) => collapsedKeys.has(commentKeyOf(comment)),
    [collapsedKeys]
  )

  // A function which folds a comment's replies away, or opens them back up
  const toggle = useCallback(
    (comment: CommentData) =>
      setCollapsedKeys((previous) => toggleSetItem(previous, commentKeyOf(comment))),
    []
  )

  // Whether each comment is folded, and the way to fold or open one
  return { isCollapsed, toggle }
}
