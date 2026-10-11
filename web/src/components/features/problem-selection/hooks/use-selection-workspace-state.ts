'use client'

import { useMemo } from 'react'

import { SECOND_MS } from '@/components/shared/utils/time-units'
import { useApiQuery } from '@/hooks/use-api-query'
import { cachePolicy, hasFailedForGood } from '@/lib/query-config'
import type { QueryUiState } from '@/lib/query-ui-state'

import { indexSelection, type SelectionIndex } from '../model/selection-state'
import type { Board, SelectionData } from '../model/selection-types'
import { getSelection } from '../services/selection-service'
import { useSelectionQueryKey } from './selection-cache'
import { useBoardPicking, type UseBoardPickingResult } from './use-board-picking'
import { useOpenDetail, type UseOpenDetailResult } from './use-open-detail'
import { usePoolFilters, type UsePoolFiltersResult } from './use-pool-filters'
import { useIsChangingSlots, useIsSelectionWriting } from './use-selection-write'

/**
 * How often the selection is read again while the page is in view, so it keeps up with the other reviewers.
 */
const SELECTION_REFRESH_MS = 30 * SECOND_MS

/**
 * The selection once its read has landed, with the board on screen.
 */
export type LoadedSelection = SelectionIndex & {
  /** The board on screen; null when the selection holds no board. */
  activeBoard: Board | null
}

/**
 * What every part of the selection shares: the read, whether a write changing its slots is out, the page open in
 * full, what the pool is narrowed to, and the slot waiting for a problem with the ways to move it.
 */
export type SelectionWorkspace = UseOpenDetailResult &
  Omit<UseBoardPickingResult, 'activeBoard'> & {
    /** How far the read of the selection has got. */
    uiState: QueryUiState
    /** Whether a write changing what the slots hold is still out, any read it waits for included. */
    isChangingSlots: boolean
    /** Reads the selection again after the read gave up. */
    retry: () => void
    /** The selection; null until its read lands. */
    selection: LoadedSelection | null
    /** What the pool is narrowed to, and the ways of changing it. */
    poolFilters: UsePoolFiltersResult
  }

/**
 * The selection's shared state, read in one go: every part draws from the same read, so opening a problem or a
 * paper never waits on the network.
 *
 * @returns The workspace.
 */
export function useSelectionWorkspaceState(): SelectionWorkspace {
  // Where the reader's selection is cached
  const queryKey = useSelectionQueryKey()

  // Whether any write to the selection is still out
  const isWriting = useIsSelectionWriting()

  // The whole selection, read as whoever is signed in
  const { data, uiState, retry } = useApiQuery<SelectionData>({
    queryKey,
    fetch: getSelection,
    // The selection is never public, so the read waits for an account
    requireAuth: true,
    // Other reviewers move things too, so the selection counts as fresh only briefly
    ...cachePolicy.userData,
    // Read again on coming back to the tab, except over a refusal that stands or while a write is out, since a
    // read landing then could cover the write's edit with the selection from before it
    refetchOnWindowFocus: (query) => !isWriting && !hasFailedForGood(query.state),
    // Read again every little while in view, except at those same times
    refetchInterval: (query) =>
      isWriting || hasFailedForGood(query.state) ? false : SELECTION_REFRESH_MS,
  })

  // The page open in full, and the ways in and out of it
  const { detail, paperBeneathId, openDetail, closeDetail, leaveDetail, poolCountRef } =
    useOpenDetail()

  // What the pool is narrowed to, and the ways of changing it
  const poolFilters = usePoolFilters()

  // The selection with its lookups by paper and by proposal, rebuilt only when a new read lands
  const index = useMemo(() => (data === undefined ? null : indexSelection(data)), [data])

  // The board being filled, the slot on it waiting for a problem, and the ways to change both
  const { activeBoard, waitingSlot, selectBoard, toggleWaiting, stopWaiting } = useBoardPicking(
    index?.boards ?? []
  )

  // The selection with the board on screen, once the read has landed
  const selection = useMemo(
    () => (index === null ? null : { ...index, activeBoard }),
    [index, activeBoard]
  )

  // Whether a write changing the slots is still out
  const isChangingSlots = useIsChangingSlots()

  // Everything the parts share, held steady while none of it moves
  return useMemo(
    () => ({
      uiState,
      isChangingSlots,
      retry,
      selection,
      detail,
      paperBeneathId,
      openDetail,
      closeDetail,
      leaveDetail,
      poolCountRef,
      poolFilters,
      waitingSlot,
      selectBoard,
      toggleWaiting,
      stopWaiting,
    }),
    [
      uiState,
      isChangingSlots,
      retry,
      selection,
      detail,
      paperBeneathId,
      openDetail,
      closeDetail,
      leaveDetail,
      poolCountRef,
      poolFilters,
      waitingSlot,
      selectBoard,
      toggleWaiting,
      stopWaiting,
    ]
  )
}
