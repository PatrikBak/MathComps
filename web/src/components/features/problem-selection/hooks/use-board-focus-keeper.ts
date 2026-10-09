'use client'

import { usePrevious, useWindowEvent } from '@mantine/hooks'
import { type RefObject, useEffect, useRef } from 'react'

import type { Board } from '../model/selection-types'

/**
 * Return type for {@link useBoardFocusKeeper}.
 */
type UseBoardFocusKeeperResult = {
  /** The menu of the boards, which takes the focus when the board on screen leaves the selection. */
  menuRef: RefObject<HTMLButtonElement | null>
  /** The line naming a finalized board's rounds, which takes the focus when the board on screen is finalized. */
  statusRef: RefObject<HTMLParagraphElement | null>
}

/**
 * Keeps the focus on the board when a read finalizes the board on screen or takes it out of the selection.
 * Finalizing the board takes away every control that changes it, on the board and on the problems alike, and a
 * board leaving the selection takes its slots with it. Either can take the focus along, which would leave the next
 * Tab at the top of the page, so the focus goes to the line saying where the board went, or to the menu of the
 * boards left. Only a focus the change took away moves: one left standing, or none taken at all, stays as it is,
 * and the page loading or the reader picking another board moves none.
 *
 * @param boards - Every board the selection holds.
 * @param activeBoard - The board on screen; null when there is none.
 *
 * @returns The places the focus goes.
 */
export function useBoardFocusKeeper(
  boards: readonly Board[],
  activeBoard: Board | null
): UseBoardFocusKeeperResult {
  // The places the focus goes
  const menuRef = useRef<HTMLButtonElement>(null)
  const statusRef = useRef<HTMLParagraphElement>(null)

  // What last took the focus anywhere on the page; null until something has
  const lastFocusedRef = useRef<Element | null>(null)

  // Kept up with as the focus moves
  useWindowEvent('focusin', (event) => {
    // Whatever took it
    lastFocusedRef.current = event.target instanceof Element ? event.target : null
  })

  // The board on screen before the change; undefined on the first render
  const previousBoard = usePrevious(activeBoard)

  // The focus picked up wherever a change of the board took it away
  useEffect(() => {
    // The first board shown, or no board left to show, moves nothing
    if (previousBoard == null || activeBoard === null) return

    // A focus the change left standing stays, and so does none taken at all
    if (lastFocusedRef.current?.isConnected !== false) return

    // The same board on screen, which the change may have finalized
    if (previousBoard.id === activeBoard.id) {
      // Finalized, so the focus goes to the line saying where it went
      if (previousBoard.finalization === null && activeBoard.finalization !== null) {
        statusRef.current?.focus({ preventScroll: true })
      }

      // Nothing else of the board's changes takes the focus anywhere
      return
    }

    // Another board on screen since the one before left the selection, so the focus goes to the menu of those left
    if (!boards.some((board) => board.id === previousBoard.id)) {
      menuRef.current?.focus({ preventScroll: true })
    }
  }, [boards, activeBoard, previousBoard])

  // The places the focus goes
  return { menuRef, statusRef }
}
