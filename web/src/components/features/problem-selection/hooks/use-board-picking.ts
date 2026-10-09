'use client'

import { useCallback, useState } from 'react'

import { useKeyedState } from '@/hooks/use-keyed-state'

import { pickActiveBoard, sameSlot } from '../model/selection-state'
import type { Board, SlotAddress } from '../model/selection-types'

/**
 * Return type for {@link useBoardPicking}.
 */
export type UseBoardPickingResult = {
  /** The board on screen; null when there is none. */
  activeBoard: Board | null
  /** The slot the next placement goes into, on the board on screen; null when none is waiting. */
  waitingSlot: SlotAddress | null
  /** Puts a board on screen, letting go of a slot waiting on any other. */
  selectBoard: (boardId: string) => void
  /** Makes a slot the one the next placement goes into, or lets it go when it already is. */
  toggleWaiting: (slot: SlotAddress) => void
  /** Lets the waiting slot go. */
  stopWaiting: () => void
}

/**
 * Which board the reader is filling, and which of its slots waits for a problem from the pool. The board on
 * screen stays there until the reader picks another or it leaves the selection, so finalizing it, by this
 * reader or another, never puts a different board in its place. A slot waiting on it when it is finalized is
 * let go, a finalized board taking no placement.
 *
 * @param boards - Every board the selection holds, none until it arrives.
 *
 * @returns The board on screen, the slot waiting on it, and the ways to change both.
 */
export function useBoardPicking(boards: readonly Board[]): UseBoardPickingResult {
  // The board kept on screen, by id: the one picked, else the one shown first; null before any is shown
  const [shownBoardId, setShownBoardId] = useState<string | null>(null)

  // The board on screen
  const activeBoard = pickActiveBoard(boards, shownBoardId)

  // Whatever board ends up on screen is the one kept there from now on
  if (activeBoard !== null && activeBoard.id !== shownBoardId) setShownBoardId(activeBoard.id)

  // Whether the board on screen has been finalized
  const isShownBoardFinalized = activeBoard !== null && activeBoard.finalization !== null

  // The slot waiting for a problem, let go whenever the board on screen is finalized under it
  const [waitingSlot, setWaitingSlot] = useKeyedState<SlotAddress | null>(
    isShownBoardFinalized,
    null
  )

  // A function which puts a board on screen
  const selectBoard = useCallback(
    (boardId: string) => {
      // The board picked
      setShownBoardId(boardId)

      // And a slot waiting on any other board let go
      setWaitingSlot((current) =>
        current !== null && current.boardId === boardId ? current : null
      )
    },
    [setWaitingSlot]
  )

  // A function which makes a slot the waiting one, or lets it go when it already is
  const toggleWaiting = useCallback(
    (slot: SlotAddress) =>
      setWaitingSlot((current) => (current !== null && sameSlot(current, slot) ? null : slot)),
    [setWaitingSlot]
  )

  // A function which lets the waiting slot go
  const stopWaiting = useCallback(() => setWaitingSlot(null), [setWaitingSlot])

  // The waiting slot, while it sits on the board on screen
  const waitingOnScreen =
    waitingSlot !== null && waitingSlot.boardId === activeBoard?.id ? waitingSlot : null

  // The board on screen, the slot waiting on it, and the ways to change both
  return { activeBoard, waitingSlot: waitingOnScreen, selectBoard, toggleWaiting, stopWaiting }
}
