'use client'

import { useAuth } from '@clerk/nextjs'

import { useAreaEntry } from '@/components/features/hosted-competitions/hooks/use-area-entry'
import { assertNever } from '@/components/shared/utils/assert-never'
import type { QueryUiState } from '@/lib/query-ui-state'

import { competitionSlugOf } from '../model/defense-target'
import type {
  DefenseCompetitionRun,
  DefenseProblem,
  DefenseSessionListItem,
} from '../model/defense-types'

/**
 * What a defense waiting on nothing reports. Module-level so every render hands out the same object.
 */
const READY: QueryUiState = { kind: 'ready' }

/**
 * Return type for {@link useLibraryConversation}.
 */
type UseLibraryConversationResult = {
  /**
   * The problem to open the conversation on; null while nothing is chosen, while a competition problem is
   * still waiting on the entry it was argued under, and for a graded one with no entry to read it against.
   */
  problem: DefenseProblem | null
  /** The run the conversation is being argued inside, or null outside a competition. */
  competition: DefenseCompetitionRun | null
  /**
   * How far the read behind the problem got, so a chosen defense that cannot be opened says so rather than
   * waiting for good. Ready for a handout defense, which waits on nothing.
   */
  uiState: QueryUiState
}

/**
 * Works out what a chosen defense opens as. A competition one opens on the terms its own area opens it on,
 * the entry and its clock included, so the same conversation reads the same wherever it was reached from.
 *
 * That entry is read before the conversation is handed over rather than alongside it: without one the chat
 * offers to rewind and delete a graded conversation the backend refuses to change. A conversation nobody
 * grades, held by a reader who never entered, opens without one once the read says there is none, which is
 * how the area opens it too.
 *
 * @param defense - The defense the student chose, or null while they are still on the list.
 *
 * @returns The problem to open on, and the run it is argued inside.
 */
export function useLibraryConversation(
  defense: DefenseSessionListItem | null
): UseLibraryConversationResult {
  // Whose defenses these are, once Clerk knows
  const { userId, isLoaded: isUserLoaded } = useAuth()

  // Which competition the chosen defense was held in, absent for a handout one
  const competitionSlug = defense === null ? null : competitionSlugOf(defense.target)

  // The entry the chosen defense was argued under, which only a competition one has
  const { entry, uiState } = useAreaEntry(userId ?? null, isUserLoaded, competitionSlug)

  // Nothing chosen, so there is nothing to open
  if (defense === null) {
    return { problem: null, competition: null, uiState: READY }
  }

  // What it opens as, which each kind of target answers differently
  switch (defense.target.kind) {
    // A handout problem, argued under nothing and open whenever
    case 'handout':
      return {
        problem: {
          target: { kind: 'handout', environment: defense.target },
          statement: defense.statement,
        },
        competition: null,
        uiState: READY,
      }

    // A competition problem, opened against the entry the reader spent on it, if they spent one
    case 'problem': {
      // The problem as the competition's own area opens it
      const problem: DefenseProblem = {
        target: {
          kind: 'competition',
          problemId: defense.target.problemId,
          readerKey: userId ?? null,
        },
        statement: defense.statement,
      }

      // An entry spent, so the conversation is argued inside the run it bought
      if (entry !== null) {
        return { problem, competition: { entry, isGraded: defense.isGraded }, uiState }
      }

      // The read behind the entry still going or given up on, so it waits rather than opening without one
      if (uiState.kind !== 'ready') {
        return { problem: null, competition: null, uiState }
      }

      // No entry, and nobody grades it, so nothing of the reader's own is spent on it
      if (!defense.isGraded) {
        return { problem, competition: null, uiState }
      }

      // Graded, with no entry to hold the conversation to
      return { problem: null, competition: null, uiState }
    }

    // A proposal, argued under nothing and open whenever
    case 'proposal':
      return {
        problem: {
          target: { kind: 'proposal', problemId: defense.target.problemId },
          statement: defense.statement,
        },
        competition: null,
        uiState: READY,
      }

    // Every target is handled above
    default:
      return assertNever(defense.target)
  }
}
