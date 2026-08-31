'use client'

import { useAuth } from '@clerk/nextjs'

import { useAreaEntry } from '@/components/features/hosted-competitions/hooks/use-area-entry'
import { assertNever } from '@/components/shared/utils/assert-never'
import type { QueryUiState } from '@/lib/query-ui-state'

import { competitionIdOf } from '../model/defense-target'
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
   * The problem to open the conversation on; null while nothing is chosen, and while a competition problem
   * is still waiting on the entry it was argued under.
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
 * offers to rewind and delete a graded conversation the backend refuses to change.
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
  const competitionId = defense === null ? null : competitionIdOf(defense.target)

  // The entry it was argued under, which only a competition one has
  const { entry, uiState } = useAreaEntry(userId ?? null, isUserLoaded, competitionId)

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

    // A competition problem, which waits for the entry rather than opening without it
    case 'problem':
      return entry === null
        ? { problem: null, competition: null, uiState }
        : {
            problem: {
              target: {
                kind: 'competition',
                competitionId: defense.target.competitionId,
                problemId: defense.target.problemId,
                readerKey: userId ?? null,
              },
              statement: defense.statement,
            },
            competition: { entry, isGraded: defense.isGraded },
            uiState,
          }

    // Every target is handled above
    default:
      return assertNever(defense.target)
  }
}
