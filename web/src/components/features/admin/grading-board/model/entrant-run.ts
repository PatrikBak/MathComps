import {
  entryEndsAt,
  noteWindowClosesAt,
} from '@/components/features/hosted-competitions/model/hosted-competition-state'
import { MINUTE_MS } from '@/components/shared/utils/time-units'

import type { GradingBoard, GradingEntrant } from './grading-types'

/**
 * An entrant still inside their clock, so more of their conversations may still count.
 */
type RunSolving = {
  /** Which state the entrant is in. */
  kind: 'solving'
  /** When their clock stops, as an ISO-8601 string. */
  until: string
}

/**
 * An entrant whose clock has stopped but who may still comment on their own solutions.
 */
type RunNoteOpen = {
  /** Which state the entrant is in. */
  kind: 'noteOpen'
  /** When they can no longer comment, as an ISO-8601 string. */
  until: string
}

/**
 * An entrant with nothing more to come.
 */
type RunDone = {
  /** Which state the entrant is in. */
  kind: 'done'
}

/**
 * Where an entrant stands on their own run: still solving, still able to comment, or done.
 */
export type EntrantRun = RunSolving | RunNoteOpen | RunDone

/**
 * Whether an entrant may still write, by the state they are in.
 */
export const IS_RUN_LIVE: Record<EntrantRun['kind'], boolean> = {
  solving: true,
  noteOpen: true,
  done: false,
}

/**
 * Whether an entrant is still on their clock, by the state they are in.
 */
export const IS_STILL_SOLVING: Record<EntrantRun['kind'], boolean> = {
  solving: true,
  noteOpen: false,
  done: false,
}

/**
 * Reads where an entrant stands on their own run at one instant.
 *
 * A hand-in stops the clock outright, even a stamp sitting a moment ahead of the instant it is read against, since a
 * browser and whatever wrote the stamp never agree to the second.
 *
 * @param entrant - The entrant.
 * @param terms - How long the board's entries run, and how long a note stays open after one ends.
 * @param now - The instant to read it against, in epoch milliseconds.
 *
 * @returns The state, with when it ends.
 */
export function entrantRun(
  entrant: GradingEntrant,
  terms: Pick<GradingBoard, 'clockMinutes' | 'noteGraceMinutes'>,
  now: number
): EntrantRun {
  // When the entry stops counting: its clock running out, or the hand-in ahead of that
  const endsAt = entryEndsAt(terms, entrant)

  // Not handed in, and the clock still running
  if (entrant.finishedAt === null && Date.parse(endsAt) > now) {
    return { kind: 'solving', until: endsAt }
  }

  // When their window for commenting closes
  const noteClosesAt = noteWindowClosesAt(endsAt, terms.noteGraceMinutes)

  // Still inside the window for commenting
  if (noteClosesAt > now) {
    return { kind: 'noteOpen', until: new Date(noteClosesAt).toISOString() }
  }

  // Nothing more to come
  return { kind: 'done' }
}

/**
 * Whether anything on a board can still change on its own: a clock started before the close may still be running,
 * or somebody on it can still comment. A student is on the board only once they have written, so the clocks of those
 * not on it yet are bounded by the close alone: nobody starts one after it.
 *
 * @param board - The board.
 * @param now - The instant to read it against, in epoch milliseconds.
 *
 * @returns Whether it is live.
 */
export function isBoardLive(board: GradingBoard, now: number): boolean {
  // The latest any clock can stop: one started at the very close
  const lastClockStopsAt = Date.parse(board.closesAt) + board.clockMinutes * MINUTE_MS

  // A clock still possibly running, or anybody on any competition not done yet
  return (
    lastClockStopsAt > now ||
    board.competitions.some((competition) =>
      competition.entrants.some((entrant) => IS_RUN_LIVE[entrantRun(entrant, board, now).kind])
    )
  )
}
