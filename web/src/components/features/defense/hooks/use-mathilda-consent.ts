import { useAuth } from '@clerk/nextjs'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useTranslations } from 'next-intl'
import { useCallback } from 'react'

import { readyApiCall, useApi } from '@/hooks/use-api'
import { useOptimisticMutation } from '@/hooks/use-optimistic-mutation'
import { unwrap } from '@/lib/api/api-error'
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
  /** Whether a re-read is in flight. */
  isRetrying: boolean
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

  // API client for the signed-in caller
  const api = useApi({ requireAuth: true })

  // Whose acknowledgement it is, once Clerk knows
  const { userId, isLoaded: isUserLoaded } = useAuth()

  // Where this student's acknowledgement is cached, held under a null user until Clerk has settled who they are
  const consentKey = mathildaConsentQueryKeys.forUser(isUserLoaded ? (userId ?? null) : null)

  // Where the student stands
  const query = useQuery({
    queryKey: consentKey,
    queryFn: async () => {
      // Narrow to the ready caller
      const apiCall = readyApiCall(api)

      // The standing acknowledgement, or throwing the backend failure
      return unwrap(await getMathildaConsent(apiCall))
    },
    // An acknowledgement given on another device should show up here promptly
    ...cachePolicy.userData,
    // Only fetch once there is a signed-in caller to ask about
    enabled: api.state === 'ready',
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

  // The query's own re-read
  const { refetch } = query

  // A function which reads the acknowledgement again
  const retry = useCallback(() => void refetch(), [refetch])

  // Where the student stands, and the calls that record it and re-read it
  return {
    status: resolveConsentStatus(query),
    accept,
    isAccepting: mutation.isPending,
    retry,
    isRetrying: query.isFetching,
  }
}
