'use client'

import type { QueryClient } from '@tanstack/react-query'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useTranslations } from 'next-intl'
import { useCallback } from 'react'
import { toast } from 'sonner'

import { forgetCompetitionDefenseLists } from '@/components/features/defense/hooks/defense-cache'
import { forgetDefenseDraft } from '@/components/features/defense/model/defense-target'
import { assertNever } from '@/components/shared/utils/assert-never'
import { useOptimisticMutation } from '@/hooks/use-optimistic-mutation'
import { unwrap } from '@/lib/api/api-error'

import type { EntryReadiness, SpentEntry } from '../model/hosted-competition-types'
import {
  enterHostedCompetition,
  forfeitHostedCompetition,
  useMockViewer,
} from '../services/hosted-competition-mock-service'
import type { HostedCompetitionsReaderKey } from './hosted-competition-cache'
import {
  entryReadinessQueryKey,
  hostedCompetitionsViewQueryKey,
  writeCachedEntry,
  writeCachedProblems,
} from './hosted-competition-cache'

/**
 * Return type for {@link useEnterHostedCompetition}.
 */
type UseEnterHostedCompetitionResult = {
  /** Takes the student's entry into one category. Referentially stable for the hook's lifetime. */
  enter: (competitionId: string) => void
  /** Spends the entry on reading the problems instead. Referentially stable for the hook's lifetime. */
  forfeit: (competitionId: string) => void
  /** Whether an entry or a forfeit is in flight. */
  isEntering: boolean
}

/**
 * The two things a press can do to one competition: sit it, or give it up for the problems. Both spend the
 * entry and both carry the rules acceptance on a first entry ever, which is why they are one hook rather
 * than two copies of the same cache writes.
 *
 * The call is not optimistic. Showing a clock that a failure then takes back would be showing a student
 * time they never had, and this is the one press on the site with nothing behind it to undo.
 *
 * @param readerKey - Who the cached answers belong to.
 * @param onEntered - Called with the competition entered, once the entry has landed.
 *
 * @returns The two calls, and whether either is in flight.
 */
export function useEnterHostedCompetition(
  readerKey: HostedCompetitionsReaderKey,
  onEntered: (competitionId: string) => void
): UseEnterHostedCompetitionResult {
  // Competitions copy
  const t = useTranslations('competitions')

  // Who is reading, as far as the mocked backend is concerned
  const { viewer } = useMockViewer()

  // The React Query cache
  const queryClient = useQueryClient()

  // What a landed entry does to the page, whichever call carried it
  const land = useCallback(
    (spent: SpentEntry, competitionId: string) => {
      // The entry onto its own row, so nothing on the page waits for a round trip to show it
      writeCachedEntry(queryClient, readerKey, competitionId, spent.entry)

      // And the problems it bought, which came back with it: the clock is running from here, so the area
      // must not open on a read the student is the one paying for
      writeCachedProblems(queryClient, readerKey, competitionId, spent.problems)

      // Forget the conversation lists the last run left cached
      forgetCompetitionDefenseLists(queryClient, competitionId)

      // And every half-written turn the last run left in a composer
      for (const problem of spent.problems) {
        forgetDefenseDraft({ kind: 'competition', competitionId, problemId: problem.id, readerKey })
      }

      // The acceptance that rode along with it, a first entry ever carrying one
      writeRulesAccepted(queryClient, readerKey)

      // And the student, sent where the entry they just spent is read
      onEntered(competitionId)

      // Then the server settles the view, an entry changing more than the entry: the problems can turn
      // public
      void queryClient.invalidateQueries({ queryKey: hostedCompetitionsViewQueryKey(readerKey) })
    },
    [queryClient, readerKey, onEntered]
  )

  // Taking the entry
  const entryMutation = useOptimisticMutation<SpentEntry, string>({
    apiFn: (_apiCall, competitionId) => enterHostedCompetition(competitionId),
    onSuccess: land,
    authReason: t('entryAuthReason'),
    errorMessage: t('entryError'),
  })

  // Giving it up for the problems, which lands in the cache the same way an entry does
  const forfeitMutation = useOptimisticMutation<SpentEntry, string>({
    apiFn: (_apiCall, competitionId) => forfeitHostedCompetition(competitionId),
    onSuccess: land,
    authReason: t('entryAuthReason'),
    errorMessage: t('forfeitError'),
  })

  // The same entry, taken without the auth gate. The shared mutation weighs a real Clerk session before
  // it fires, which `?scenario=` has no way to hand it, so a mocked student would be turned away at the
  // one press this whole page exists for. It goes when the mocked service does
  const mockedEntryMutation = useMutation({
    mutationFn: async (competitionId: string) => {
      // The entry and the set it bought, or throwing the mocked failure
      return unwrap(await enterHostedCompetition(competitionId))
    },
    onSuccess: land,
    onError: () => toast.error(t('entryError')),
  })

  // The same for a forfeit, and it goes with the one above
  const mockedForfeitMutation = useMutation({
    mutationFn: async (competitionId: string) => {
      // The spent entry and the set it bought, or throwing the mocked failure
      return unwrap(await forfeitHostedCompetition(competitionId))
    },
    onSuccess: land,
    onError: () => toast.error(t('forfeitError')),
  })

  // Whichever pair this reader's presses can actually go through
  switch (viewer) {
    // A student the address invented, whose entries the mock takes and the backend never hears of
    case 'student':
      return {
        enter: mockedEntryMutation.mutate,
        forfeit: mockedForfeitMutation.mutate,
        isEntering: mockedEntryMutation.isPending || mockedForfeitMutation.isPending,
      }

    // Anybody the mock did not invent, signed in or not
    case 'real':
    case 'anonymous':
      return {
        enter: entryMutation.mutate,
        forfeit: forfeitMutation.mutate,
        isEntering: entryMutation.isPending || forfeitMutation.isPending,
      }

    // Every viewer is handled above
    default:
      return assertNever(viewer)
  }
}

/**
 * Records in the cache that the student has now accepted the rules.
 *
 * @param queryClient - The React Query cache.
 * @param readerKey - Who the cached readiness belongs to.
 */
function writeRulesAccepted(
  queryClient: QueryClient,
  readerKey: HostedCompetitionsReaderKey
): void {
  // The acceptance is given once ever, so every later entry finds it already there
  queryClient.setQueryData<EntryReadiness>(entryReadinessQueryKey(readerKey), (readiness) =>
    readiness === undefined ? readiness : { ...readiness, hasAcceptedRules: true }
  )
}
