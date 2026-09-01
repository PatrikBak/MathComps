'use client'

import { useQueryClient } from '@tanstack/react-query'
import { useTranslations } from 'next-intl'

import { useOptimisticMutation } from '@/hooks/use-optimistic-mutation'

import type { HostedCompetitionEntry } from '../model/hosted-competition-types'
import { finishHostedCompetition } from '../services/hosted-competition-service'
import type { HostedCompetitionsReaderKey } from './hosted-competition-cache'
import { invalidateHostedCompetitions, writeCachedEntry } from './hosted-competition-cache'

/**
 * Return type for {@link useFinishHostedCompetition}.
 */
type UseFinishHostedCompetitionResult = {
  /** Closes the entry where the student says rather than where the clock does. */
  finish: () => void
  /** Whether the press is in flight. */
  isFinishing: boolean
}

/**
 * Handing an entry in ahead of its clock.
 *
 * Not optimistic, for the same reason entering is not: the press cannot be undone, so the page waits for
 * the backend before it says the entry is closed.
 *
 * @param readerKey - Who the cached answers belong to.
 * @param competitionSlug - Which competition is being handed in.
 * @param onFinished - Called once the entry is closed.
 *
 * @returns The press, and whether it is in flight.
 */
export function useFinishHostedCompetition(
  readerKey: HostedCompetitionsReaderKey,
  competitionSlug: string,
  onFinished: () => void
): UseFinishHostedCompetitionResult {
  // Competitions copy
  const t = useTranslations('competitions')

  // The React Query cache
  const queryClient = useQueryClient()

  // What a landed hand-in does to the page
  const land = (entry: HostedCompetitionEntry) => {
    // The clock stops on what came back, so nothing on screen waits for a round trip
    writeCachedEntry(queryClient, readerKey, competitionSlug, entry)

    // And the caller takes the reader wherever a closed entry belongs
    onFinished()

    // And then the server settles it, a closed entry being able to change more than the entry
    invalidateHostedCompetitions(queryClient)
  }

  // Handing it in
  const mutation = useOptimisticMutation<HostedCompetitionEntry, void>({
    apiFn: (apiCall) => finishHostedCompetition(apiCall, competitionSlug),
    onSuccess: land,
    authReason: t('entryAuthReason'),
    errorMessage: t('finishError'),
  })

  // The press, and whether it is in flight
  return { finish: () => mutation.mutate(), isFinishing: mutation.isPending }
}
