'use client'

import type { QueryClient } from '@tanstack/react-query'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useTranslations } from 'next-intl'
import { useCallback } from 'react'
import { toast } from 'sonner'

import { useOptimisticMutation } from '@/hooks/use-optimistic-mutation'
import { unwrap } from '@/lib/api/api-error'

import type {
  EntryReadiness,
  HostedCompetitionEntry,
  HostedCompetitionsView,
} from '../model/hosted-competition-types'
import {
  enterHostedCompetition,
  forfeitHostedCompetition,
  useMockViewer,
} from '../services/hosted-competition-mock-service'
import type { HostedCompetitionsReaderKey } from './hosted-competition-cache'
import {
  entryReadinessQueryKey,
  HOSTED_COMPETITIONS_QUERY_KEY,
  hostedCompetitionsViewQueryKey,
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
 * @param onEntered - Called once the entry has landed.
 *
 * @returns The two calls, and whether either is in flight.
 */
export function useEnterHostedCompetition(
  readerKey: HostedCompetitionsReaderKey,
  onEntered: () => void
): UseEnterHostedCompetitionResult {
  // Competitions copy
  const t = useTranslations('competitions')

  // Whether a mocked student is reading, who has no session for the auth-gated path to check
  const { viewer } = useMockViewer()

  // The React Query cache
  const queryClient = useQueryClient()

  // What a landed entry does to the page, whichever call carried it
  const land = useCallback(
    (entry: HostedCompetitionEntry, competitionId: string) => {
      // The screen moves on what came back, so nothing on it waits for a round trip
      writeEntry(queryClient, readerKey, competitionId, entry)
      writeRulesAccepted(queryClient, readerKey)
      onEntered()

      // And then the server settles it. What an entry changes is more than the entry: the problems can
      // turn public, which is not in the response being echoed above. The echo is for the eye and this
      // is for the truth
      void queryClient.invalidateQueries({ queryKey: HOSTED_COMPETITIONS_QUERY_KEY })
    },
    [queryClient, readerKey, onEntered]
  )

  // Taking the entry
  const entryMutation = useOptimisticMutation<HostedCompetitionEntry, string>({
    apiFn: (_apiCall, competitionId) => enterHostedCompetition(competitionId),
    onSuccess: land,
    authReason: t('entryAuthReason'),
    errorMessage: t('entryError'),
  })

  // Giving it up for the problems, which lands in the cache the same way an entry does
  const forfeitMutation = useOptimisticMutation<HostedCompetitionEntry, string>({
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
      // The entry, or throwing the mocked failure
      return unwrap(await enterHostedCompetition(competitionId))
    },
    onSuccess: land,
    onError: () => toast.error(t('entryError')),
  })

  // The same for a forfeit, and it goes with the one above
  const mockedForfeitMutation = useMutation({
    mutationFn: async (competitionId: string) => {
      // The entry, or throwing the mocked failure
      return unwrap(await forfeitHostedCompetition(competitionId))
    },
    onSuccess: land,
    onError: () => toast.error(t('forfeitError')),
  })

  // Whichever of the two this reader can actually use
  return viewer === 'student'
    ? {
        enter: mockedEntryMutation.mutate,
        forfeit: mockedForfeitMutation.mutate,
        isEntering: mockedEntryMutation.isPending || mockedForfeitMutation.isPending,
      }
    : {
        enter: entryMutation.mutate,
        forfeit: forfeitMutation.mutate,
        isEntering: entryMutation.isPending || forfeitMutation.isPending,
      }
}

/**
 * Puts a fresh entry onto its category in the cached view.
 *
 * @param queryClient - The React Query cache.
 * @param readerKey - Who the cached view belongs to.
 * @param competitionId - Which competition was entered.
 * @param entry - The entry that was created.
 */
function writeEntry(
  queryClient: QueryClient,
  readerKey: HostedCompetitionsReaderKey,
  competitionId: string,
  entry: HostedCompetitionEntry
): void {
  // Swap the entry onto its own competition and leave every other one alone
  queryClient.setQueryData<HostedCompetitionsView>(
    hostedCompetitionsViewQueryKey(readerKey),
    (view) => {
      // Nothing cached to write into
      if (view === undefined) {
        return view
      }

      // The same view with the entry on its own competition
      return {
        groups: view.groups.map((group) => ({
          ...group,
          competitions: group.competitions.map((competition) =>
            competition.id === competitionId ? { ...competition, entry } : competition
          ),
        })),
      }
    }
  )
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
