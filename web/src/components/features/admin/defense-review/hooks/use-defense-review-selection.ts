import { useCallback, useMemo } from 'react'

import { useSteppedSelection, type UseSteppedSelectionResult } from '@/hooks/use-stepped-selection'

import { findNextUnreadId } from '../model/defense-review-stepping'

/**
 * What {@link useDefenseReviewSelection} hands back: the walk through the queue, plus a skip over what has
 * already been read.
 */
export type UseDefenseReviewSelectionResult = UseSteppedSelectionResult & {
  /** Moves to the next conversation along that is still unread, staying put when none is. */
  stepUnread: () => void
  /** Whether an unread conversation sits further along the queue. */
  canStepUnread: boolean
}

/**
 * Holds which conversation is being read and walks the queue from it, with a skip past whatever has already been
 * read.
 *
 * @param orderedConversationIds - Every loaded conversation's id, in the order the queue shows them.
 * @param unreadConversationIds - Which of those are still unread, as of the last time the queue was read.
 * @param initialOpenId - The conversation the address named when the queue opened; null when it named none.
 *
 * @returns The selection as described by {@link UseDefenseReviewSelectionResult}.
 */
export function useDefenseReviewSelection(
  orderedConversationIds: string[],
  unreadConversationIds: ReadonlySet<string>,
  initialOpenId: string | null
): UseDefenseReviewSelectionResult {
  // The walk through the queue
  const selection = useSteppedSelection(orderedConversationIds, initialOpenId)

  // The pieces of the walk the skip reads
  const { openId, open } = selection

  // Where the next unread conversation is
  const nextUnreadId = useMemo(
    () => findNextUnreadId(orderedConversationIds, openId, unreadConversationIds),
    [orderedConversationIds, openId, unreadConversationIds]
  )

  // Skips whatever has already been read
  const stepUnread = useCallback(() => {
    // Skip there, unless the rest of the queue has been read
    if (nextUnreadId !== null) open(nextUnreadId)
  }, [nextUnreadId, open])

  // Whether there is an unread one to skip to
  const canStepUnread = nextUnreadId !== null

  // The walk, and the skip on top of it
  return { ...selection, stepUnread, canStepUnread }
}
