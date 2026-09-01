'use client'

import type { QueryClient } from '@tanstack/react-query'
import { useQueryClient } from '@tanstack/react-query'
import { useTranslations } from 'next-intl'
import { useCallback } from 'react'

import { forgetCompetitionDefenseLists } from '@/components/features/defense/hooks/defense-cache'
import { forgetDefenseDraft } from '@/components/features/defense/model/defense-target'
import { useOptimisticMutation } from '@/hooks/use-optimistic-mutation'

import type { EntryReadiness, SpentEntry } from '../model/hosted-competition-types'
import {
  enterHostedCompetition,
  forfeitHostedCompetition,
} from '../services/hosted-competition-service'
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
  enter: (competitionSlug: string) => void
  /** Spends the entry on reading the problems instead. Referentially stable for the hook's lifetime. */
  forfeit: (competitionSlug: string) => void
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
  onEntered: (competitionSlug: string) => void
): UseEnterHostedCompetitionResult {
  // Competitions copy
  const t = useTranslations('competitions')

  // The React Query cache
  const queryClient = useQueryClient()

  // What a landed entry does to the page, whichever call carried it
  const land = useCallback(
    (spent: SpentEntry, competitionSlug: string) => {
      // The entry onto its own row, so nothing on the page waits for a round trip to show it
      writeCachedEntry(queryClient, readerKey, competitionSlug, spent.entry)

      // And the problems it bought, which came back with it: the clock is running from here, so the area
      // must not open on a read the student is the one paying for
      writeCachedProblems(queryClient, readerKey, competitionSlug, spent.problems)

      // Forget the conversation lists the last run left cached
      forgetCompetitionDefenseLists(
        queryClient,
        spent.problems.map((problem) => problem.id)
      )

      // And every half-written turn the last run left in a composer
      for (const problem of spent.problems) {
        forgetDefenseDraft({ kind: 'competition', problemId: problem.id, readerKey })
      }

      // The acceptance that rode along with it, a first entry ever carrying one
      writeRulesAccepted(queryClient, readerKey)

      // And the student, sent where the entry they just spent is read
      onEntered(competitionSlug)

      // Then the server settles the view, an entry changing more than the entry: the problems can turn
      // public
      void queryClient.invalidateQueries({ queryKey: hostedCompetitionsViewQueryKey(readerKey) })
    },
    [queryClient, readerKey, onEntered]
  )

  // Taking the entry
  const entryMutation = useOptimisticMutation<SpentEntry, string>({
    apiFn: (apiCall, competitionSlug) => enterHostedCompetition(apiCall, competitionSlug),
    onSuccess: land,
    authReason: t('entryAuthReason'),
    errorMessage: t('entryError'),
  })

  // Giving it up for the problems, which lands in the cache the same way an entry does
  const forfeitMutation = useOptimisticMutation<SpentEntry, string>({
    apiFn: (apiCall, competitionSlug) => forfeitHostedCompetition(apiCall, competitionSlug),
    onSuccess: land,
    authReason: t('entryAuthReason'),
    errorMessage: t('forfeitError'),
  })

  // The two presses, and whether either is in flight
  return {
    enter: entryMutation.mutate,
    forfeit: forfeitMutation.mutate,
    isEntering: entryMutation.isPending || forfeitMutation.isPending,
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
