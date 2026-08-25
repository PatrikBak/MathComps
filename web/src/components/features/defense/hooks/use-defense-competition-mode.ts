'use client'

import type { AreaEntry } from '@/components/features/hosted-competitions/model/hosted-competition-state'
import { SECOND_MS } from '@/components/shared/utils/time-units'
import { useNow } from '@/hooks/use-now'

import type { Turn } from '../model/defense-types'

/**
 * What a competition adds to a defense conversation.
 */
type UseDefenseCompetitionModeResult = {
  /** Whether the entry's clock has run out, so nothing said from here counts towards it. */
  hasClockExpired: boolean
  /** The instant the clock is being read against, in epoch milliseconds. */
  now: number
  /** The first turn the clock no longer covers, which the line sits above; null when none is. */
  firstUncountedTurnId: string | null
}

/**
 * Reads where a defense stands against the competition entry it is being argued inside.
 *
 * Outside a competition every answer is the quiet one, so the caller can render off it either way.
 *
 * @param competition - The entry it is being argued inside, or null outside one.
 * @param turns - The conversation so far, oldest first.
 *
 * @returns What the competition adds.
 */
export function useDefenseCompetitionMode(
  competition: AreaEntry | null,
  turns: readonly Turn[]
): UseDefenseCompetitionModeResult {
  // When the entry stops counting, which an entry given up for the problems never started doing
  const endsAt = competition?.kind === 'sat' ? competition.endsAt : null

  // The clock the banner appears on, which has to move without anybody reloading. Held still where there
  // is no deadline to cross, a chat being left mounted after it closes
  const now = useNow(SECOND_MS, endsAt !== null)

  // Where the defense stands against the entry
  return {
    now,
    hasClockExpired: endsAt !== null && Date.parse(endsAt) <= now,
    firstUncountedTurnId: endsAt === null ? null : findFirstUncountedTurnId(turns, endsAt),
  }
}

/**
 * Finds the first turn a competition entry's clock no longer covers, which is where the conversation stops
 * counting towards the entry.
 *
 * The instant itself belongs to the entry, so a turn recorded on it still counts. An unstamped draft is
 * nowhere in particular, so nothing marks it.
 *
 * @param turns - The conversation in order, oldest first.
 * @param endsAt - When the clock ran out, as an ISO-8601 string.
 *
 * @returns The id of the first turn past it, or null when none of them is.
 */
export function findFirstUncountedTurnId(turns: readonly Turn[], endsAt: string): string | null {
  // The instant the entry stops covering what is said
  const endsAtMs = Date.parse(endsAt)

  // Read in order, so the first one past it is the earliest one past it
  for (const turn of turns) {
    // A turn nothing has stamped or named cannot be pointed at
    if (turn.createdAt === null || turn.id === null) {
      continue
    }

    // The first one past the instant is the one the line sits above
    if (Date.parse(turn.createdAt) > endsAtMs) {
      return turn.id
    }
  }

  // Everything said so far is covered
  return null
}
