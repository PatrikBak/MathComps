'use client'

import { usePrevious, useWindowEvent } from '@mantine/hooks'
import { type RefObject, useCallback, useEffect, useRef } from 'react'

import { focusForReader } from '@/components/shared/utils/focus-utils'

import { canFinalize, isDraft } from '../model/selection-state'
import type { Board } from '../model/selection-types'

/**
 * Return type for {@link useBoardFocusKeeper}.
 */
type UseBoardFocusKeeperResult = {
  /** The line naming the board's rounds, which takes the focus when the board on screen is finalized. */
  statusRef: RefObject<HTMLParagraphElement | null>
  /** The switch to another board, which takes the focus when a draft on screen stops being finalizable. */
  boardMenuRef: RefObject<HTMLButtonElement | null>
  /**
   * Puts the focus where a board's Finalize stood: on the line naming its rounds once it is finalized, on the switch
   * to another board while it stays a draft.
   */
  focusPastFinalize: (board: Board) => void
}

/**
 * Keeps the focus on the board when a read takes away the board's Finalize or finalizes the board. Finalizing the
 * board takes away every control that changes it, on the board and on the problems alike, which can take the focus
 * along and leave the next Tab at the top of the page, so the focus goes to the line saying where the board went. A
 * draft that stops being finalizable loses only its Finalize, and the focus goes to the switch to another board.
 * Only a focus the change took away moves: one left standing, or none taken at all, stays as it is, and the page
 * loading or the reader picking another board moves none.
 *
 * @param activeBoard - The board on screen; null when there is none.
 *
 * @returns The places the focus goes to, and the way to put it there.
 */
export function useBoardFocusKeeper(activeBoard: Board | null): UseBoardFocusKeeperResult {
  // The line naming the board's rounds
  const statusRef = useRef<HTMLParagraphElement>(null)

  // The switch to another board
  const boardMenuRef = useRef<HTMLButtonElement>(null)

  // What last took the focus anywhere on the page; null until something has
  const lastFocusedRef = useRef<Element | null>(null)

  // Kept up with as the focus moves
  useWindowEvent('focusin', (event) => {
    // Whatever took it
    lastFocusedRef.current = event.target instanceof Element ? event.target : null
  })

  // The board on screen before the change; undefined on the first render
  const previousBoard = usePrevious(activeBoard)

  // A function which puts the focus where a board's Finalize stood, by whether the board was finalized
  const focusPastFinalize = useCallback(
    (board: Board) =>
      focusForReader(isDraft(board) ? boardMenuRef.current : statusRef.current, {
        preventScroll: true,
      }),
    []
  )

  // The focus picked up wherever a change of the board took it away
  useEffect(() => {
    // The first board shown, or no board left to show, moves nothing
    if (previousBoard == null || activeBoard === null) return

    // A focus the change left standing stays, and so does none taken at all
    if (lastFocusedRef.current?.isConnected !== false) return

    // Whether the change took away the board's Finalize
    const tookFinalize = canFinalize(previousBoard) && !canFinalize(activeBoard)

    // Whether the change finalized the board, which takes away every control that changes it, Finalize offered or not
    const finalizedBoard = isDraft(previousBoard) && !isDraft(activeBoard)

    // The same board on screen, its Finalize or every control taken away, so the focus goes where the Finalize stood
    if (previousBoard.id === activeBoard.id && (tookFinalize || finalizedBoard)) {
      focusPastFinalize(activeBoard)
    }
  }, [activeBoard, previousBoard, focusPastFinalize])

  // The places the focus goes to, and the way to put it there
  return { statusRef, boardMenuRef, focusPastFinalize }
}
