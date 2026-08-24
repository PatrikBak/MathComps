'use client'

import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useTranslations } from 'next-intl'
import { toast } from 'sonner'

import { assertNever } from '@/components/shared/utils/assert-never'
import { useOptimisticMutation } from '@/hooks/use-optimistic-mutation'
import { unwrap } from '@/lib/api/api-error'

import type { HostedCompetitionEntry } from '../model/hosted-competition-types'
import { finishHostedCompetition, useMockViewer } from '../services/hosted-competition-mock-service'
import type { HostedCompetitionsReaderKey } from './hosted-competition-cache'
import { HOSTED_COMPETITIONS_QUERY_KEY, writeCachedEntry } from './hosted-competition-cache'

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
 * @param competitionId - Which competition is being handed in.
 * @param onFinished - Called once the entry is closed.
 *
 * @returns The press, and whether it is in flight.
 */
export function useFinishHostedCompetition(
  readerKey: HostedCompetitionsReaderKey,
  competitionId: string,
  onFinished: () => void
): UseFinishHostedCompetitionResult {
  // Competitions copy
  const t = useTranslations('competitions')

  // Whether a mocked student is reading, who has no session for the auth-gated path to check
  const { viewer } = useMockViewer()

  // The React Query cache
  const queryClient = useQueryClient()

  // What a landed hand-in does to the page
  const land = (entry: HostedCompetitionEntry) => {
    // The clock stops on what came back, so nothing on screen waits for a round trip
    writeCachedEntry(queryClient, readerKey, competitionId, entry)

    // And the caller takes the reader wherever a closed entry belongs
    onFinished()

    // And then the server settles it, a closed entry being able to change more than the entry
    void queryClient.invalidateQueries({ queryKey: HOSTED_COMPETITIONS_QUERY_KEY })
  }

  // Handing it in
  const mutation = useOptimisticMutation<HostedCompetitionEntry, void>({
    apiFn: () => finishHostedCompetition(competitionId),
    onSuccess: land,
    authReason: t('entryAuthReason'),
    errorMessage: t('finishError'),
  })

  // The same press without the auth gate. The shared mutation weighs a real Clerk session before it fires,
  // which `?scenario=` has no way to hand it. It goes when the mocked service does
  const mockedMutation = useMutation({
    mutationFn: async () => unwrap(await finishHostedCompetition(competitionId)),
    onSuccess: land,
    onError: () => toast.error(t('finishError')),
  })

  // Whichever press this reader can actually go through
  switch (viewer) {
    // A student the address invented, whose hand-in the mock takes and the backend never hears of
    case 'student':
      return { finish: () => mockedMutation.mutate(), isFinishing: mockedMutation.isPending }

    // Anybody the mock did not invent, signed in or not
    case 'real':
    case 'anonymous':
      return { finish: () => mutation.mutate(), isFinishing: mutation.isPending }

    // Every viewer is handled above
    default:
      return assertNever(viewer)
  }
}
