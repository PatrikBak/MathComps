'use client'

import { useAuth } from '@clerk/nextjs'
import type { QueryClient, QueryKey } from '@tanstack/react-query'

import { SECOND_MS } from '@/components/shared/utils/time-units'

import { useSelectionOrganization } from './selection-organization'

/**
 * How often the selection's reads run again while the page is in view, so what they show keeps up with the other
 * reviewers.
 */
export const SELECTION_REFRESH_MS = 30 * SECOND_MS

/**
 * The prefix every cached copy of a selection sits under, whichever organization's it is and whoever it was read as.
 */
const SELECTION_QUERY_KEY = ['problem-selection'] as const

/**
 * The key the reader's copy of the selection on screen is cached under, which the read and every write to it
 * share. It names the organization, whose selection it is, and the reader, because the read is theirs: the token
 * rides in a header the cache never sees, and another account signing in on the same page must not be handed the
 * first one's answer.
 *
 * @returns The key, naming nobody until sign-in has settled who the reader is.
 */
export function useSelectionQueryKey(): QueryKey {
  // The organization whose selection is on screen
  const organization = useSelectionOrganization()

  // Who is reading, once sign-in has settled
  const { userId, isLoaded } = useAuth()

  // The selection, per organization and reader, naming nobody until sign-in has settled or while nobody is signed in
  return [...SELECTION_QUERY_KEY, organization, isLoaded ? (userId ?? null) : null] as const
}

/**
 * Refreshes every cached copy of a selection, whichever organization's it is and whoever it was read as. Every write
 * changes something every reader's copy shows.
 *
 * @param queryClient - The cache to refresh.
 *
 * @returns A promise settling once the copies on screen have been read again.
 */
export function invalidateSelection(queryClient: QueryClient): Promise<void> {
  // Every copy under the shared prefix, whichever reader its key names
  return queryClient.invalidateQueries({ queryKey: SELECTION_QUERY_KEY })
}
