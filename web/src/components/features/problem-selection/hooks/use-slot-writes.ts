'use client'

import { useTranslations } from 'next-intl'
import { type RefObject, useEffect, useRef } from 'react'

import { useSelectionWorkspace } from '../components/SelectionWorkspaceProvider'
import { afterClearing } from '../model/selection-edits'
import type { BoardSlot } from '../model/selection-state'
import type { SlotAddress, SlotDirection } from '../model/selection-types'
import { clearSlot } from '../services/selection-service'
import type { UsePaperMovesResult } from './use-paper-moves'
import { useSelectionWrite } from './use-selection-write'

/**
 * Return type for {@link useSlotWrites}.
 */
type UseSlotWritesResult = {
  /** Whether the slot's own emptying is still out. */
  isClearing: boolean
  /** The slot's Move up button, which takes the focus while a problem moving up stands in the slot. */
  moveUpRef: RefObject<HTMLButtonElement | null>
  /** The slot's Move down button, which takes the focus while a problem moving down stands in the slot. */
  moveDownRef: RefObject<HTMLButtonElement | null>
  /** Whether the slot can send its problem back to the pool now: no write changing the slots is out. */
  canClear: boolean
  /** Whether the slot can trade with the one above it now: there is one, and no write changing the slots is out. */
  canMoveUp: boolean
  /** Whether the slot can trade with the one below it now: there is one, and no write changing the slots is out. */
  canMoveDown: boolean
  /** Trades the slot with the one above it. */
  moveUp: () => void
  /** Trades the slot with the one below it. */
  moveDown: () => void
  /** Empties the slot, its problem going back to the pool. */
  clear: () => void
}

/**
 * The writes a draft's slot fires: trading places with a neighbour, and sending its problem back to the pool.
 * None is available while a write changing the slots is out, since a slot named then can hold another problem by
 * the time the write lands. While its paper's move is out, a focus on the paper follows the problem moved, onto
 * the button moving it on the same way in whichever slot shows it, so pressing it again carries the problem
 * further.
 *
 * @param slot - The slot, with the board and the paper holding it.
 * @param moves - The moves along the slot's paper.
 *
 * @returns Whether each write is available, the ways to fire them, and the buttons the focus follows a move onto.
 */
export function useSlotWrites(
  { board, paper, index }: BoardSlot,
  { pendingMove, listRef, move }: UsePaperMovesResult
): UseSlotWritesResult {
  // The slot's Move buttons
  const moveUpRef = useRef<HTMLButtonElement>(null)
  const moveDownRef = useRef<HTMLButtonElement>(null)

  // The way the problem of the paper's move still out is heading, while the slot shows it; null while it doesn't
  const followedDirection =
    pendingMove !== null && paper.slots[index] === pendingMove.proposalId
      ? pendingMove.direction
      : null

  // The focus following that problem into the slot, onto the button moving it on the same way
  useEffect(() => {
    // The problem moved stands elsewhere, or nothing is moving
    if (followedDirection === null) return

    // Where the focus stands now
    const focused = document.activeElement

    // A focus the reader has since taken off the paper stays there, even when a move that fails puts the problem back
    if (focused !== document.body && !listRef.current?.contains(focused)) return

    // The slot's Move buttons, by the way each moves the problem
    const moveButtons: Record<SlotDirection, RefObject<HTMLButtonElement | null>> = {
      up: moveUpRef,
      down: moveDownRef,
    }

    // The one moving it on, focused
    moveButtons[followedDirection].current?.focus()
  }, [followedDirection, listRef])

  // A function which trades the slot with the one above it
  const moveUp = () => move(index, 'up')

  // A function which trades the slot with the one below it
  const moveDown = () => move(index, 'down')

  // Copy for the selection's writes
  const t = useTranslations('problemSelection.writes')

  // Emptying the slot, shown ahead of the server
  const clearing = useSelectionWrite<SlotAddress>({
    apiFn: clearSlot,
    edit: afterClearing,
    changesSlots: true,
    errorMessage: t('clearFailed'),
  })

  // A function which empties the slot, its problem going back to the pool
  const clear = () => clearing.mutate({ boardId: board.id, paperId: paper.id, index })

  // Whether a write changing the slots is still out
  const { isChangingSlots } = useSelectionWorkspace()

  // Whether the slot can send its problem back: no write changing the slots is out
  const canClear = !isChangingSlots

  // Whether the slot can trade upwards: a slot sits above it, and no write changing the slots is out
  const canMoveUp = !isChangingSlots && index > 0

  // Whether the slot can trade downwards: a slot sits below it, and no write changing the slots is out
  const canMoveDown = !isChangingSlots && index < paper.slots.length - 1

  // Whether the slot's own emptying is still out
  const isClearing = clearing.pendingVariables !== null

  // Whether each write is available, the ways to fire them, and the buttons the focus follows a move onto
  return {
    isClearing,
    moveUpRef,
    moveDownRef,
    canClear,
    canMoveUp,
    canMoveDown,
    moveUp,
    moveDown,
    clear,
  }
}
