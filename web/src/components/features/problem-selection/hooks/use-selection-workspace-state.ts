'use client'

import { useMemo } from 'react'

import { useApiQuery } from '@/hooks/use-api-query'
import { cachePolicy } from '@/lib/query-config'
import type { QueryUiState } from '@/lib/query-ui-state'

import { indexSelection, type SelectionIndex } from '../model/selection-state'
import type { Board, SelectionData } from '../model/selection-types'
import { getSelection } from '../services/selection-service'
import { useSelectionQueryKey } from './selection-cache'
import { useSelectionOrganization } from './selection-organization'
import { useBoardPicking, type UseBoardPickingResult } from './use-board-picking'
import { useOpenDetail, type UseOpenDetailResult } from './use-open-detail'
import { usePoolFilters, type UsePoolFiltersResult } from './use-pool-filters'
import { useIsChangingSlots } from './use-selection-write'

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
  // The organization whose selection it is
  const organization = useSelectionOrganization()

  // Where the reader's selection is cached
  const queryKey = useSelectionQueryKey()

  // The whole selection, read as whoever is signed in
  const { data, uiState, retry } = useApiQuery<SelectionData>({
    queryKey,
    fetch: (apiCall) => getSelection(apiCall, organization),
    // The selection is never public, so the read waits for an account
    requireAuth: true,
    // Other reviewers move things too, so the selection keeps up with them while it is open
    cachePolicy: cachePolicy.live,
  })

  // The page open in full, and the ways in and out of it
  const { detail, paperBeneathId, openDetail, closeDetail, leaveDetail, poolCountRef } =
    useOpenDetail()

  // The selection with its lookups by paper and by proposal, rebuilt only when a new read lands
  const index = useMemo(() => (data === undefined ? null : indexSelection(data)), [data])

  // What the pool is narrowed to, and the ways of changing it
  const poolFilters = usePoolFilters(index?.categories ?? null)

  // The board being filled, the slot on it waiting for a problem, and the ways to change both
  const { activeBoard, waitingSlot, selectBoard, toggleWaiting, stopWaiting } = useBoardPicking({
    boards: index?.boards ?? [],
    leadCategories: index?.leadCategories ?? [],
  })

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
