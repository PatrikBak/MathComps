'use client'

import type { Locale } from '@/i18n/i18n'

import { useLoadedSelection } from '../components/SelectionWorkspaceProvider'
import { unreadyLanguages } from '../model/selection-state'
import type { Proposal } from '../model/selection-types'

/**
 * Return type for {@link useBoardSlot}.
 */
type UseBoardSlotResult = {
  /** The problem in the slot; undefined while the slot stands empty. */
  proposal: Proposal | undefined
  /** The languages a round would refuse the slot's problem in; empty while the slot stands empty. */
  missingLanguages: Locale[]
}

/**
 * One slot on the board: the problem it holds, and the languages a round would refuse it in.
 *
 * @param proposalId - The problem in the slot, by id; null when the slot stands empty.
 *
 * @returns The slot's problem and the languages it falls short in.
 */
export function useBoardSlot(proposalId: string | null): UseBoardSlotResult {
  // Every proposal, by id
  const { proposalsById } = useLoadedSelection()

  // The problem in the slot, where one is
  const proposal = proposalId === null ? undefined : proposalsById.get(proposalId)

  // The languages a round would refuse the problem in, none while the slot stands empty
  const missingLanguages = proposal === undefined ? [] : unreadyLanguages(proposal)

  // The slot's problem, and the languages it falls short in
  return { proposal, missingLanguages }
}
