import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useTranslations } from 'next-intl'
import { useCallback } from 'react'

import { readyApiCall, useApi } from '@/hooks/use-api'
import { useOptimisticMutation } from '@/hooks/use-optimistic-mutation'
import { unwrap } from '@/lib/api/api-error'
import { cachePolicy } from '@/lib/query-config'

import type { MathildaConsent } from '../model/defense-types'
import { getMathildaConsent, recordMathildaConsent } from '../services/consent-service'

/**
 * Query keys for the student's Mathilda acknowledgement, used for cache management.
 */
const mathildaConsentQueryKeys = {
  all: ['mathildaConsent'] as const,
}

/**
 * Return type for {@link useMathildaConsent}.
 */
type UseMathildaConsentResult = {
  /** Whether the student has been told what talking to Mathilda entails. */
  hasConsented: boolean
  /** Whether the answer is still being read, so neither state is known yet. */
  isLoading: boolean
  /** Records the acknowledgement. Referentially stable for the hook's lifetime. */
  accept: () => void
  /** Whether an acknowledgement is in flight. */
  isAccepting: boolean
}

/**
 * The student's standing acknowledgement that Mathilda is not a person and that conversations with her are
 * stored and read, and the way to give it. A failed read reports no acknowledgement, so an answer nobody got
 * cannot pass for one.
 *
 * @returns Where the student stands, and the call that records it.
 */
export function useMathildaConsent(): UseMathildaConsentResult {
  // Defense-surface copy
  const t = useTranslations('defense')

  // The React Query cache
  const queryClient = useQueryClient()

  // API client for the signed-in caller
  const api = useApi({ requireAuth: true })

  // Where the student stands
  const query = useQuery({
    queryKey: mathildaConsentQueryKeys.all,
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
      queryClient.setQueryData<MathildaConsent>(mathildaConsentQueryKeys.all, {
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

  // Where the student stands, and the call that records it
  return {
    hasConsented: query.data?.consentedAt != null,
    isLoading: query.isLoading,
    accept,
    isAccepting: mutation.isPending,
  }
}
