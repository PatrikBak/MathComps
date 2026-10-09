'use client'

import { useState } from 'react'

import { useLoadedSelection } from '../components/SelectionWorkspaceProvider'
import { type CycleMisfit, cycleMisfit, fitsCycle } from '../model/selection-state'
import type { Board, Cycle, FinalizationWrite } from '../model/selection-types'
import type { SelectionWrite } from './use-selection-write'

/**
 * One cycle on offer, with what keeps a board's papers out of its rounds.
 */
type CycleOption = {
  /** The cycle. */
  cycle: Cycle
  /** What keeps the papers out of its rounds, every list empty where they fit. */
  misfit: CycleMisfit
}

/**
 * Return type for {@link useFinalizeChoice}.
 */
type UseFinalizeChoiceResult = {
  /** Every cycle on offer, with what keeps the papers out of each. */
  options: CycleOption[]
  /** The cycle the papers go into on confirming, by id; null while the papers fit no picked cycle. */
  cycleId: string | null
  /** Picks a cycle, by id. */
  pick: (cycleId: string) => void
  /** Finalizes the board into that cycle. */
  confirm: () => void
}

/**
 * Which cycle a board goes into, and the finalize itself. The first cycle the papers fit is picked when the
 * choice is first drawn, and a pick the papers stop fitting leaves nothing to confirm rather than moving to
 * another cycle, since the finalize can't be taken back.
 *
 * @param board - The board being finalized.
 * @param finalize - Finalizing the board.
 * @param onAnswered - Runs once the server has answered the finalize, taken or refused, and the selection has been
 * read again.
 *
 * @returns The cycles on offer, the one the papers go into, and the ways to pick and confirm.
 */
export function useFinalizeChoice(
  board: Board,
  finalize: SelectionWrite<FinalizationWrite>,
  onAnswered: () => void
): UseFinalizeChoiceResult {
  // The cycles on offer
  const { cycles } = useLoadedSelection()

  // Each cycle with what keeps the papers out of its rounds
  const options = cycles.map((cycle) => ({ cycle, misfit: cycleMisfit(board, cycle) }))

  // The cycles the papers fit, by id
  const fittingIds = options
    .filter((option) => fitsCycle(option.misfit))
    .map((option) => option.cycle.id)

  // The cycle picked, by id: the first the papers fit when the choice is drawn, until the reader picks another
  const [pickedCycleId, pick] = useState<string | null>(() => fittingIds[0] ?? null)

  // The cycle the papers go into: the one picked, while the papers still fit it
  const cycleId =
    pickedCycleId !== null && fittingIds.includes(pickedCycleId) ? pickedCycleId : null

  // A function which finalizes the board into that cycle
  const confirm = () => {
    // No picked cycle the papers fit, so nothing to finalize into
    if (cycleId === null) return

    // The board goes into the cycle's rounds
    finalize.mutate({ boardId: board.id, cycleId }, onAnswered)
  }

  // The cycles on offer, the one the papers go into, and the ways to pick and confirm
  return { options, cycleId, pick, confirm }
}
