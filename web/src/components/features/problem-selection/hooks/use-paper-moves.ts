'use client'

import { useTranslations } from 'next-intl'
import { type RefObject, useRef } from 'react'

import { useSelectionWorkspace } from '../components/SelectionWorkspaceProvider'
import { afterMove, MOVE_STEP } from '../model/selection-edits'
import { type BoardSlot, sameSlot } from '../model/selection-state'
import type { MoveWrite, SlotAddress, SlotDirection } from '../model/selection-types'
import { moveSlot } from '../services/selection-service'
import { useSelectionWrite } from './use-selection-write'

/**
 * A slot's problem trading places with its neighbour's, the problem named so the focus can follow it.
 */
type ProblemMove = MoveWrite & {
  /** The problem in the slot, which ends up beside it, by id. */
  proposalId: string
}

/**
 * Return type for {@link usePaperMoves}.
 */
export type UsePaperMovesResult = {
  /** The paper's move still out, any read it waits for included; null while none is. */
  pendingMove: ProblemMove | null
  /** The paper's list of slots. */
  listRef: RefObject<HTMLOListElement | null>
  /** Trades the problem in a slot, by its position, with its neighbour's that way. */
  move: (index: number, direction: SlotDirection) => void
}

/**
 * The moves along one paper, each a slot's problem trading places with its neighbour's. The paper knows its move
 * still out, so whichever slot shows the problem it moves can take a focus still on the paper.
 *
 * @param paper - The paper, with the board holding it.
 *
 * @returns The paper's move still out, its list of slots, and the way to move a slot's problem.
 */
export function usePaperMoves({ board, paper }: Omit<BoardSlot, 'index'>): UsePaperMovesResult {
  // Copy for the selection's writes
  const t = useTranslations('problemSelection.writes')

  // Trading a slot with its neighbour, shown ahead of the server
  const moving = useSelectionWrite<ProblemMove>({
    apiFn: moveSlot,
    edit: afterMove,
    changesSlots: true,
    errorMessage: t('moveFailed'),
  })

  // The slot waiting for a problem, and the way to let it go
  const { waitingSlot, stopWaiting } = useSelectionWorkspace()

  // A function which trades the problem in a slot with its neighbour's that way
  const move = (index: number, direction: SlotDirection) => {
    // The problem in the slot
    const proposalId = paper.slots[index]

    // An empty slot has no problem to move
    if (proposalId === null) return

    // The slot, addressed from outside the board
    const slot: SlotAddress = { boardId: board.id, paperId: paper.id, index }

    // The trade itself, which another write changing the slots still out turns away
    if (!moving.mutate({ slot, direction, proposalId })) return

    // The slot on the other side of the trade
    const partner: SlotAddress = { ...slot, index: index + MOVE_STEP[direction] }

    // A slot waiting on either side of the trade stops waiting, since the trade changes what it holds
    if (waitingSlot !== null && (sameSlot(waitingSlot, slot) || sameSlot(waitingSlot, partner))) {
      stopWaiting()
    }
  }

  // The paper's list of slots
  const listRef = useRef<HTMLOListElement>(null)

  // The move still out, the list, and the way to move a slot's problem
  return { pendingMove: moving.pendingVariables, listRef, move }
}
