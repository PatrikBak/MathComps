import { type RefObject, useEffect } from 'react'

/**
 * Brings whichever turn is being pointed at into view.
 *
 * What points at one stands beside the conversation rather than in it, so the turn it names can sit anywhere
 * above or below what is on screen, and a mark nobody can see says nothing about what was picked.
 *
 * @param paneRef - The scrolling pane the conversation is read in.
 * @param pointedAtTurnId - The turn to move to; null when nothing points at one.
 */
export function useRevealPointedTurn(
  paneRef: RefObject<HTMLDivElement | null>,
  pointedAtTurnId: string | null
): void {
  // Move to it whenever another turn is the one being pointed at
  useEffect(() => {
    // Nothing points at a turn, so there is nowhere to move
    if (pointedAtTurnId === null) return

    // The turn itself, there only while it belongs to the conversation on screen
    const turn = paneRef.current?.querySelector(`[data-turn-id="${CSS.escape(pointedAtTurnId)}"]`)

    // Centred, and at once: a smooth scroll trails behind a thumb run along the conversation
    turn?.scrollIntoView({ block: 'center', behavior: 'instant' })
  }, [paneRef, pointedAtTurnId])
}
