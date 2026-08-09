import { useCallback, useMemo, useState } from 'react'

import {
  canStepFrom,
  describePosition,
  findNextUnreadId,
  type SelectionPosition,
  stepTarget,
} from '../model/defense-review-stepping'

/**
 * What {@link useDefenseReviewSelection} hands back.
 */
export type UseDefenseReviewSelectionResult = {
  /** The conversation being read; null while none is. */
  openId: string | null
  /** Where it sits in the queue; null while none is open. */
  position: SelectionPosition | null
  /** Opens one conversation. */
  open: (sessionId: string) => void
  /** Closes whichever is open. */
  close: () => void
  /** Moves to the conversation that many places along, staying put at either end. */
  step: (delta: 1 | -1) => void
  /** Whether there is a conversation that many places along to move to. */
  canStep: (delta: 1 | -1) => boolean
  /** Moves to the next conversation along that is still unread, staying put when none is. */
  stepUnread: () => void
  /** Whether an unread conversation sits further along the queue. */
  canStepUnread: boolean
}

/**
 * Holds which conversation is being read, and walks the queue from it.
 *
 * The walk follows the queue's own order, since a stepper that disagreed with the list would be disorienting.
 * Where each move lands is worked out in {@link stepTarget} and its neighbours.
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
  initialOpenId: string | null = null
): UseDefenseReviewSelectionResult {
  // Which conversation is being read
  const [openId, setOpenId] = useState<string | null>(initialOpenId)

  // Whether there is somewhere to step to
  const canStep = useCallback(
    (delta: 1 | -1) => canStepFrom(orderedConversationIds, openId, delta),
    [orderedConversationIds, openId]
  )

  // Moves along the queue, staying put where the walk has run out
  const step = useCallback(
    (delta: 1 | -1) => {
      // Where the move lands
      const target = stepTarget(orderedConversationIds, openId, delta)

      // Move there, unless the walk has run out
      if (target !== null) setOpenId(target)
    },
    [orderedConversationIds, openId]
  )

  // Where the next unread conversation is
  const nextUnreadId = useMemo(
    () => findNextUnreadId(orderedConversationIds, openId, unreadConversationIds),
    [orderedConversationIds, openId, unreadConversationIds]
  )

  // Skips whatever has already been read
  const stepUnread = useCallback(() => {
    // Skip there, unless the rest of the queue has been read
    if (nextUnreadId !== null) setOpenId(nextUnreadId)
  }, [nextUnreadId])

  // Opens one conversation
  const open = useCallback((sessionId: string) => setOpenId(sessionId), [])

  // Closes whichever is open
  const close = useCallback(() => setOpenId(null), [])

  // Which conversation is open, where it sits in the queue, and every way of moving off it
  return {
    openId,
    position: describePosition(orderedConversationIds, openId),
    open,
    close,
    step,
    canStep,
    stepUnread,
    canStepUnread: nextUnreadId !== null,
  }
}
