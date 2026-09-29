import type { StoredTurn } from '@/components/features/defense/model/defense-types'
import { assertNever } from '@/components/shared/utils/assert-never'

import type { DefenseTurnAttempt } from './admin-conversation'

/**
 * How long a run took: its drafts added up, since they're written one after another.
 *
 * @param drafts - The run's drafts.
 *
 * @returns The run's duration, in milliseconds.
 */
export function totalDurationMs(drafts: readonly DefenseTurnAttempt[]): number {
  // Each draft's time, one after another
  return drafts.reduce((total, draft) => total + draft.durationMs, 0)
}

/**
 * Works out how long each turn took its author.
 *
 * The examiner's figure is the run of drafts behind her reply, so a reply held before drafts were kept has none.
 * The student's is the time from the turn above to their own arriving, which counts reading the reply as well as
 * writing the answer. Their first message is stamped together with the opener it went in with, so nothing times
 * it.
 *
 * @param turns - The conversation, oldest first.
 * @param attemptsByTurn - The drafts each reply kept, by reply.
 *
 * @returns How long each timed turn took, in milliseconds, by turn.
 */
export function resolveTurnDurationsMs(
  turns: readonly StoredTurn[],
  attemptsByTurn: ReadonlyMap<string, readonly DefenseTurnAttempt[]>
): Map<string, number> {
  // Where the student's first message sits
  const firstCandidateIndex = turns.findIndex((turn) => turn.role === 'candidate')

  // Every turn that has a figure, paired with it
  return new Map(
    turns.flatMap((turn, index): [string, number][] => {
      // Whose turn it is decides where its figure comes from
      switch (turn.role) {
        // Hers comes from her drafts
        case 'examiner': {
          // The drafts this reply kept
          const attempts = attemptsByTurn.get(turn.id)

          // A reply held before drafts were kept has nothing to time it by
          if (attempts === undefined) {
            return []
          }

          // Otherwise the whole run of them
          return [[turn.id, totalDurationMs(attempts)]]
        }

        // The student's is the time since the turn above
        case 'candidate': {
          // The first message went in with the opener, so there is no gap to read
          if (index === firstCandidateIndex) {
            return []
          }

          // Otherwise from the turn above landing to this one arriving
          return [[turn.id, Date.parse(turn.createdAt) - Date.parse(turns[index - 1].createdAt)]]
        }

        // A role outside the union, which the type system rules out
        default:
          return assertNever(turn.role)
      }
    })
  )
}
