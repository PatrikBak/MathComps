'use client'

import { useMemo } from 'react'

import { SECOND_MS } from '@/components/shared/utils/time-units'
import { useApiQuery } from '@/hooks/use-api-query'
import { cachePolicy, hasFailedForGood } from '@/lib/query-config'
import type { QueryUiState } from '@/lib/query-ui-state'

import { indexSelection, type SelectionIndex } from '../model/selection-state'
import type { SelectionData } from '../model/selection-types'
import { getSelection } from '../services/selection-service'
import { useSelectionQueryKey } from './selection-cache'
import { useOpenProposal, type UseOpenProposalResult } from './use-open-proposal'

/**
 * How often the selection is read again while the page is in view, so it keeps up with the other reviewers.
 */
const SELECTION_REFRESH_MS = 30 * SECOND_MS

/**
 * What every part of the selection shares: the read, and the problem open in full.
 */
export type SelectionWorkspace = UseOpenProposalResult & {
  /** How far the read of the selection has got. */
  uiState: QueryUiState
  /** Reads the selection again after the read gave up. */
  retry: () => void
  /** The selection; null until its read lands. */
  selection: SelectionIndex | null
}

/**
 * The selection's shared state, read in one go: every part draws from the same read, so opening a problem
 * never waits on the network.
 *
 * @returns The workspace.
 */
export function useSelectionWorkspaceState(): SelectionWorkspace {
  // Where the reader's selection is cached
  const queryKey = useSelectionQueryKey()

  // The whole selection, read as whoever is signed in
  const { data, uiState, retry } = useApiQuery<SelectionData>({
    queryKey,
    fetch: getSelection,
    // The selection is never public, so the read waits for an account
    requireAuth: true,
    // Other reviewers move things too, so the selection counts as fresh only briefly
    ...cachePolicy.userData,
    // Read again on coming back to the tab, except over a refusal that stands
    refetchOnWindowFocus: (query) => !hasFailedForGood(query.state),
    // Read again every little while in view, except over a refusal that stands
    refetchInterval: (query) => (hasFailedForGood(query.state) ? false : SELECTION_REFRESH_MS),
  })

  // The problem open in full, and the ways in and out of it
  const { openProposalId, openProposal, closeProposal } = useOpenProposal()

  // The selection with its lookups by proposal, rebuilt only when a new read lands
  const selection = useMemo(() => (data === undefined ? null : indexSelection(data)), [data])

  // Everything the parts share, held steady while none of it moves
  return useMemo(
    () => ({
      uiState,
      retry,
      selection,
      openProposalId,
      openProposal,
      closeProposal,
    }),
    [uiState, retry, selection, openProposalId, openProposal, closeProposal]
  )
}
