'use client'

import { useCallback, useState } from 'react'

import { pickActiveBoard } from '../model/selection-state'
import type { Board } from '../model/selection-types'

/**
 * Return type for {@link useBoardPicking}.
 */
export type UseBoardPickingResult = {
  /** The board on screen; null when there is none. */
  activeBoard: Board | null
  /** Puts a board on screen. */
  selectBoard: (boardId: string) => void
}

/**
 * Which board the reader is filling. The board on screen stays there until the reader picks another or it leaves
 * the selection, so finalizing it, by this reader or another, never puts a different board in its place.
 *
 * @param boards - Every board the selection holds, none until it arrives.
 *
 * @returns The board on screen and the way to change it.
 */
export function useBoardPicking(boards: readonly Board[]): UseBoardPickingResult {
  // The board kept on screen, by id: the one picked, else the one shown first; null before any is shown
  const [shownBoardId, setShownBoardId] = useState<string | null>(null)

  // The board on screen
  const activeBoard = pickActiveBoard(boards, shownBoardId)

  // Whatever board ends up on screen is the one kept there from now on
  if (activeBoard !== null && activeBoard.id !== shownBoardId) setShownBoardId(activeBoard.id)

  // A function which puts a board on screen
  const selectBoard = useCallback((boardId: string) => setShownBoardId(boardId), [])

  // The board on screen, and the way to change it
  return { activeBoard, selectBoard }
}
