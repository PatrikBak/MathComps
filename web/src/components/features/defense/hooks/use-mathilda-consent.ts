import { useAuth } from '@clerk/nextjs'
import { useQueryClient } from '@tanstack/react-query'
import { useTranslations } from 'next-intl'
import { useCallback } from 'react'

import { useApiQuery } from '@/hooks/use-api-query'
import { useOptimisticMutation } from '@/hooks/use-optimistic-mutation'
import { cachePolicy } from '@/lib/query-config'

import { resolveConsentStatus } from '../model/defense-composer-state'
import type { MathildaConsent, MathildaConsentStatus } from '../model/defense-types'
import { getMathildaConsent, recordMathildaConsent } from '../services/consent-service'

/**
 * Query keys for the student's Mathilda acknowledgement, used for cache management. Keyed by student, since
 * signing out and back in as somebody else never reloads the page, and an entry cached under anything less
 * takes the second reader past a gate they never stood at.
 */
const mathildaConsentQueryKeys = {
  all: ['mathildaConsent'] as const,
  forUser: (userId: string | null) => [...mathildaConsentQueryKeys.all, userId] as const,
}

/**
 * Return type for {@link useMathildaConsent}.
 */
type UseMathildaConsentResult = {
  /** Where the student stands on the acknowledgement, the read's own failure included. */
  status: MathildaConsentStatus
  /** Records the acknowledgement. Referentially stable for the hook's lifetime. */
  accept: () => void
  /** Whether an acknowledgement is in flight. */
  isAccepting: boolean
  /** Reads the acknowledgement again after a failed read. Referentially stable for the hook's lifetime. */
  retry: () => void
}

/**
 * The student's standing acknowledgement that Mathilda is not a person and that conversations with her are
 * stored and read, and the way to give it. A read that failed carries its own standing, since an answer
 * nobody got is neither the acknowledgement nor the absence of one.
 *
 * @returns Where the student stands, and the calls that record it and re-read it.
 */
export function useMathildaConsent(): UseMathildaConsentResult {
  // Defense-surface copy
  const t = useTranslations('defense')

  // The React Query cache
  const queryClient = useQueryClient()

  // Whose acknowledgement it is, once Clerk knows
  const { userId, isLoaded: isUserLoaded } = useAuth()

  // Where this student's acknowledgement is cached, held under a null user until Clerk has settled who they are
  const consentKey = mathildaConsentQueryKeys.forUser(isUserLoaded ? (userId ?? null) : null)

  // Where the student stands
  const {
    data: consent,
    uiState,
    retry,
  } = useApiQuery({
    queryKey: consentKey,
    fetch: getMathildaConsent,
    // The student's own acknowledgement, so it is read as them
    requireAuth: true,
    // An acknowledgement given on another device should show up here promptly
    ...cachePolicy.userData,
  })

  // Recording the acknowledgement
  const mutation = useOptimisticMutation<void, void>({
    // Call the consent endpoint
    apiFn: (apiCall) => recordMathildaConsent(apiCall),

    // Echo it into the cache, so nothing waits on a refetch to see it
    onSuccess: () => {
      queryClient.setQueryData<MathildaConsent>(consentKey, {
        consentedAt: new Date().toISOString(),
      })
    },

    // The reason shown in the auth prompt
    authReason: t('consentAuthReason'),

    // Fallback copy when the failure carried no recognized code
    errorMessage: t('consentError'),
  })

  // The mutation's auth-gated caller
  const { mutate } = mutation

  // A function which records the acknowledgement
  const accept = useCallback(() => mutate(), [mutate])

  // Where the student stands, and the calls that record it and re-read it
  return {
    status: resolveConsentStatus({ data: consent, isError: uiState.kind === 'failed' }),
    accept,
    isAccepting: mutation.isPending,
    retry,
  }
}
