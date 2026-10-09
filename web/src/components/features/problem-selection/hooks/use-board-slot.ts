'use client'

import type { Locale } from '@/i18n/i18n'

import { useLoadedSelection, useSelectionWorkspace } from '../components/SelectionWorkspaceProvider'
import { type BoardSlot, sameSlot, unreadyLanguages } from '../model/selection-state'
import type { Proposal, SlotAddress } from '../model/selection-types'

/**
 * Return type for {@link useBoardSlot}.
 */
type UseBoardSlotResult = {
  /** The problem in the slot; undefined while the slot stands empty. */
  proposal: Proposal | undefined
  /** The languages a round would refuse the slot's problem in; empty while the slot stands empty. */
  missingLanguages: Locale[]
  /** Whether the slot is the one waiting for a problem from the pool. */
  isWaiting: boolean
  /** Makes the slot the one waiting for a problem, or lets it go when it already is. */
  toggleWaiting: () => void
}

/**
 * One slot on the board: the problem it holds, and whether it waits for another from the pool.
 *
 * @param slot - The slot, with the board and the paper holding it.
 *
 * @returns The slot's problem, and whether it waits.
 */
export function useBoardSlot({ board, paper, index }: BoardSlot): UseBoardSlotResult {
  // The slot waiting for a problem, and the way to make a slot wait
  const { waitingSlot, toggleWaiting: toggleWaitingSlot } = useSelectionWorkspace()

  // The slot, addressed from outside the board
  const address: SlotAddress = { boardId: board.id, paperId: paper.id, index }

  // Whether this slot is the one waiting for a problem
  const isWaiting = waitingSlot !== null && sameSlot(waitingSlot, address)

  // A function which makes the slot the waiting one, or lets it go when it already is
  const toggleWaiting = () => toggleWaitingSlot(address)

  // Every proposal, by id
  const { proposalsById } = useLoadedSelection()

  // The problem in the slot, by id; null when the slot stands empty
  const proposalId = paper.slots[index]

  // The problem in the slot, where one is
  const proposal = proposalId === null ? undefined : proposalsById.get(proposalId)

  // The languages a round would refuse the problem in, none while the slot stands empty
  const missingLanguages = proposal === undefined ? [] : unreadyLanguages(proposal)

  // The slot's problem, and whether it waits
  return { proposal, missingLanguages, isWaiting, toggleWaiting }
}
