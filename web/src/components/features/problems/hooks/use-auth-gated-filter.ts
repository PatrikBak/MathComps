'use client'

import { useAuth } from '@clerk/nextjs'
import { useCallback } from 'react'

import { useLoginPromptToast } from '@/hooks/use-login-prompt-toast'

import { getProblemsPageUrl } from '../services/problem-routes'
import type { SearchFiltersState } from '../types/problem-library-types'
import { serializeFilters } from '../utils/search-url-serialization'

/**
 * The return type of the {@link useAuthGatedFilter} hook.
 */
type UseAuthGatedFilterResult = {
  /**
   * Applies filters the reader is entitled to, and asks a signed-out one to sign in instead.
   *
   * @param nextFilters - The filters the reader reached for.
   * @param reason - What the account is needed for, as the control offering the filter puts it.
   *
   * @returns Whether the choice was acted on, which it is not while nobody yet knows who is reading.
   */
  applyOrPrompt: (nextFilters: SearchFiltersState, reason: string) => boolean
}

/**
 * Applies a filter that only means something as the reader's own.
 *
 * Favorites and mark status are both refused to a signed-out reader further down, so applying one
 * for them would be undone a moment later with nothing said. Weighing the reader at the control
 * instead turns that into an offer: the prompt carries the filter they were reaching for, so signing
 * in lands them on it rather than back where they started.
 *
 * @param onFiltersChange - Applies a filter change the reader turns out to be entitled to.
 *
 * @returns The handler described by {@link UseAuthGatedFilterResult}.
 */
export function useAuthGatedFilter(
  onFiltersChange: (filters: SearchFiltersState) => void
): UseAuthGatedFilterResult {
  // Who is reading, and whether that is settled yet
  const { isLoaded, isSignedIn } = useAuth()

  // A function which asks a signed-out reader to sign in, carrying where to return to
  const showLoginPrompt = useLoginPromptToast()

  // A function which applies the filters, or asks for the account they need
  const applyOrPrompt = useCallback(
    (nextFilters: SearchFiltersState, reason: string) => {
      // Nothing can be decided until the sign-in state is known
      if (!isLoaded) return false

      // A signed-out reader is asked to sign in, and is brought back to this same choice
      if (!isSignedIn) {
        // The filters they were reaching for, as they read in a URL
        const queryString = serializeFilters(nextFilters)

        // Where to land once they are signed in
        const redirectUrl = getProblemsPageUrl(queryString)

        // The prompt says why the account is needed
        showLoginPrompt({ reason, redirectUrl })

        // The choice was answered, even though the filters were not applied
        return true
      }

      // Signed in, so the choice applies straight away
      onFiltersChange(nextFilters)

      // The filters are in force
      return true
    },
    [isLoaded, isSignedIn, showLoginPrompt, onFiltersChange]
  )

  // The one handler a control needs to offer a filter it may turn out not to be allowed to apply
  return { applyOrPrompt }
}
