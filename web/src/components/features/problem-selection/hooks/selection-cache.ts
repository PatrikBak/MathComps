'use client'

import { useAuth } from '@clerk/nextjs'
import type { QueryKey } from '@tanstack/react-query'

/**
 * The prefix every cached copy of the selection sits under, whoever it was read as.
 */
const SELECTION_QUERY_KEY = ['problem-selection'] as const

/**
 * The key the reader's selection is cached under. It names the reader because the read is theirs: the token
 * rides in a header the cache never sees, and another account signing in on the same page must not be handed
 * the first one's answer.
 *
 * @returns The key, naming nobody until sign-in has settled who the reader is.
 */
export function useSelectionQueryKey(): QueryKey {
  // Who is reading, once sign-in has settled
  const { userId, isLoaded } = useAuth()

  // The selection, per reader, naming nobody until sign-in has settled or while nobody is signed in
  return [...SELECTION_QUERY_KEY, isLoaded ? (userId ?? null) : null] as const
}
