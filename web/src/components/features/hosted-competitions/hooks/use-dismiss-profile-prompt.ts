'use client'

import { useQueryClient } from '@tanstack/react-query'
import { useTranslations } from 'next-intl'
import { useCallback } from 'react'

import { useOptimisticMutation } from '@/hooks/use-optimistic-mutation'

import type { EntryReadiness } from '../model/hosted-competition-types'
import { dismissProfilePrompt as dismissProfilePromptRequest } from '../services/hosted-competition-service'
import type { HostedCompetitionsReaderKey } from './hosted-competition-cache'
import { entryReadinessQueryKey, invalidateEntryReadiness } from './hosted-competition-cache'

/**
 * Return type for {@link useDismissProfilePrompt}.
 */
type UseDismissProfilePromptResult = {
  /** Hides the unfinished-profile sentence for good. Referentially stable for the hook's lifetime. */
  dismissProfilePrompt: () => void
}

/**
 * Taking a student's word that they do not want their unfinished profile named again, which writes
 * {@link EntryReadiness.hasHiddenProfilePrompt}.
 *
 * @param readerKey - Who the answer belongs to.
 *
 * @returns The call that hides it.
 */
export function useDismissProfilePrompt(
  readerKey: HostedCompetitionsReaderKey
): UseDismissProfilePromptResult {
  // Competitions copy
  const t = useTranslations('competitions')

  // The React Query cache
  const queryClient = useQueryClient()

  // Hiding it
  const mutation = useOptimisticMutation<void, void>({
    // Tell the backend, which is what makes it outlive this browser
    apiFn: (apiCall) => dismissProfilePromptRequest(apiCall),

    // Echo it on the press rather than on the answer, so the sentence goes the moment they ask
    onMutate: () => {
      queryClient.setQueryData<EntryReadiness>(entryReadinessQueryKey(readerKey), (previous) =>
        previous === undefined ? previous : { ...previous, hasHiddenProfilePrompt: true }
      )
    },

    // What the page says about the account has just moved
    onSettled: () => invalidateEntryReadiness(queryClient),

    // Unreachable: only a signed-in student is ever offered the dismiss, so the entry reason stands in
    authReason: t('entryAuthReason'),

    // Fallback copy when the failure carried no recognized code
    errorMessage: t('readiness.dismissError'),
  })

  // The mutation's auth-gated caller
  const { mutate } = mutation

  // A function which hides the sentence
  const dismissProfilePrompt = useCallback(() => mutate(), [mutate])

  // The call that hides it
  return { dismissProfilePrompt }
}
