'use client'

import { usePrevious, useWindowEvent } from '@mantine/hooks'
import { type RefObject, useEffect, useRef } from 'react'

import { focusForReader } from '@/components/shared/utils/focus-utils'

import type { Board } from '../model/selection-types'

/**
 * Return type for {@link useBoardFocusKeeper}.
 */
type UseBoardFocusKeeperResult = {
  /** The line naming a finalized board's rounds, which takes the focus when the board on screen is finalized. */
  statusRef: RefObject<HTMLParagraphElement | null>
}

/**
 * Keeps the focus on the board when a read finalizes the board on screen. Finalizing the board takes away every
 * control that changes it, on the board and on the problems alike, which can take the focus along and leave the next
 * Tab at the top of the page, so the focus goes to the line saying where the board went. Only a focus the change
 * took away moves: one left standing, or none taken at all, stays as it is, and the page loading or the reader
 * picking another board moves none.
 *
 * @param activeBoard - The board on screen; null when there is none.
 *
 * @returns The line the focus goes to.
 */
export function useBoardFocusKeeper(activeBoard: Board | null): UseBoardFocusKeeperResult {
  // The line the focus goes to
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

    // The same board on screen, finalized by the change, so the focus goes to the line saying where it went
    if (
      previousBoard.id === activeBoard.id &&
      previousBoard.finalization === null &&
      activeBoard.finalization !== null
    ) {
      focusForReader(statusRef.current, { preventScroll: true })
    }
  }, [activeBoard, previousBoard])

  // The line the focus goes to
  return { statusRef }
}
