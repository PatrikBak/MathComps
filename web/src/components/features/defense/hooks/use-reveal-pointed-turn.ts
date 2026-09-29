import { type RefObject, useEffect, useRef } from 'react'

import { dataAttribute } from '@/components/shared/utils/dom-utils'

/** The attribute naming which turn of the conversation an element is. */
export const TURN_ID_ATTRIBUTE = dataAttribute('data-turn-id')

/** The attribute naming the turn a line drawn across the transcript stands before. */
export const DIVIDER_BEFORE_ATTRIBUTE = dataAttribute('data-divider-before')

/**
 * Finds one turn of the conversation on screen.
 *
 * @param pane - The scrolling pane the conversation is read in.
 * @param turnId - The turn.
 * @returns The turn's element; null when the conversation on screen holds no such turn.
 */
function findTurn(pane: HTMLDivElement | null, turnId: string): Element | null {
  // The turn itself, there only while it belongs to the conversation on screen
  return pane?.querySelector(TURN_ID_ATTRIBUTE.selectorFor(turnId)) ?? null
}

/**
 * Opens each conversation at its opening turn, and brings whichever turn is being pointed at into view.
 *
 * The opening turn goes to the top with the line drawn above it, if there is one. That happens once for each
 * conversation the pane shows, so a later change of opening turn never moves the conversation out from under
 * the reader. A hidden pane has nothing to measure the turn in, so it opens the first time it is shown.
 *
 * What points at a turn stands beside the conversation rather than in it, so the turn it names can sit anywhere
 * above or below what is on screen, and a mark nobody can see says nothing about what was picked.
 *
 * @param paneRef - The scrolling pane the conversation is read in.
 * @param pointedAtTurnId - The turn to move to; null when nothing points at one.
 * @param openingTurnId - The turn each conversation opens at; null when it opens on its newest.
 */
export function useRevealPointedTurn(
  paneRef: RefObject<HTMLDivElement | null>,
  pointedAtTurnId: string | null,
  openingTurnId: string | null
): void {
  // The pane last opened, which is a new one for every conversation shown
  const openedPaneRef = useRef<HTMLDivElement | null>(null)

  // Open a conversation the pane is showing for the first time
  useEffect(() => {
    // The pane showing the conversation
    const pane = paneRef.current

    // Not up yet, opened already, or on its newest turn, which the pane sits at on its own
    if (pane === null || pane === openedPaneRef.current || openingTurnId === null) return undefined

    // A function which puts the opening turn at the top of the pane
    const open = () => {
      // Opened as of now
      openedPaneRef.current = pane

      // What goes to the top: the line drawn before the turn where there is one, and the turn itself otherwise
      const opening =
        pane.querySelector(DIVIDER_BEFORE_ATTRIBUTE.selectorFor(openingTurnId)) ??
        findTurn(pane, openingTurnId)

      // The first turn, standing where the top of a conversation is read from while the pane is at its start
      const firstTurn = pane.querySelector(TURN_ID_ATTRIBUTE.anySelector)

      // Nothing to move while the conversation holds no such turn
      if (!(opening instanceof HTMLElement) || !(firstTurn instanceof HTMLElement)) return

      // The opening up to where the first turn stands, so it clears the pane's faded edge the same way. Read
      // off the layout rather than the screen, which the dialog's opening zoom still shrinks.
      pane.scrollTop = opening.offsetTop - firstTurn.offsetTop
    }

    // On screen, so opened at once
    if (pane.clientHeight > 0) {
      // Put the opening turn at the top now
      open()

      // Nothing left to watch for
      return undefined
    }

    // Hidden, so opened the first time it is shown
    const observer = new ResizeObserver(() => {
      // Still hidden
      if (pane.clientHeight === 0) return

      // Shown, so no more watching
      observer.disconnect()

      // Put the opening turn at the top
      open()
    })

    // Watch the pane for the size it takes on when shown
    observer.observe(pane)

    // Stop watching once another conversation or the dialog's leaving takes the pane away
    return () => observer.disconnect()
  }, [paneRef, openingTurnId])

  // Move to it whenever another turn is the one being pointed at
  useEffect(() => {
    // Nothing points at a turn, so there is nowhere to move
    if (pointedAtTurnId === null) return

    // Centred, and at once: a smooth scroll trails behind a thumb run along the conversation
    findTurn(paneRef.current, pointedAtTurnId)?.scrollIntoView({
      block: 'center',
      behavior: 'instant',
    })
  }, [paneRef, pointedAtTurnId])
}
