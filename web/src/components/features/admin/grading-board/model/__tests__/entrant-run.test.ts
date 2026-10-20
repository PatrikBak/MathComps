import { describe, expect, it } from 'vitest'

import { MINUTE_MS } from '@/components/shared/utils/time-units'

import { entrantRun, isBoardLive } from '../entrant-run'
import type { GradingBoard, GradingEntrant } from '../grading-types'

/** When the entrant's clock started: 23:50 Bratislava time, on the day the group closes at 23:59. */
const STARTED_AT = Date.parse('2026-11-02T22:50:00Z')

/** When the entrant's two-hour clock runs out. */
const CLOCK_ENDS_AT = STARTED_AT + 120 * MINUTE_MS

/** When the half hour of commenting after the clock runs out closes. */
const NOTE_CLOSES_AT = CLOCK_ENDS_AT + 30 * MINUTE_MS

/** When the group stops taking entries, nine minutes after the entrant started. */
const CLOSES_AT = STARTED_AT + 9 * MINUTE_MS

/**
 * Builds the entrant.
 *
 * @param finishedAt - When they handed in, in epoch milliseconds; null while they have not.
 *
 * @returns The entrant.
 */
function entrantOf(finishedAt: number | null): GradingEntrant {
  // A late starter, handed in or not
  return {
    user: { id: 'ada', username: 'Ada', email: null },
    startedAt: new Date(STARTED_AT).toISOString(),
    finishedAt: finishedAt === null ? null : new Date(finishedAt).toISOString(),
    finishedAfterSeconds: 0,
  }
}

/**
 * Builds a board closing nine minutes after the entrant started, holding only them.
 *
 * @param noteGraceMinutes - How long a note stays open after an entry ends.
 * @param entrant - The one entrant on it.
 *
 * @returns The board.
 */
function boardOf(
  noteGraceMinutes: number,
  entrant: GradingEntrant = entrantOf(null)
): GradingBoard {
  // Two-hour clocks, one competition, the one entrant
  return {
    name: { sk: 'Kolo', cs: 'Kolo', en: 'Round' },
    opensAt: '2026-10-20T00:00:00Z',
    closesAt: new Date(CLOSES_AT).toISOString(),
    clockMinutes: 120,
    noteGraceMinutes,
    competitions: [
      {
        roundId: 'round',
        category: 'advanced',
        problems: [],
        entrants: [entrant],
        grades: [],
      },
    ],
  }
}

describe('entrantRun', () => {
  it('turns from solving to commenting the moment the clock runs out', () => {
    // A millisecond before the clock runs out
    const before = entrantRun(entrantOf(null), boardOf(30), CLOCK_ENDS_AT - 1)

    // The moment it runs out
    const after = entrantRun(entrantOf(null), boardOf(30), CLOCK_ENDS_AT)

    // Solving until the clock's end
    expect(before).toEqual({ kind: 'solving', until: new Date(CLOCK_ENDS_AT).toISOString() })

    // Then commenting for the half hour after it
    expect(after).toEqual({ kind: 'noteOpen', until: new Date(NOTE_CLOSES_AT).toISOString() })
  })

  it('is done the moment the half hour of commenting closes', () => {
    // A millisecond before the half hour of commenting closes
    const inside = entrantRun(entrantOf(null), boardOf(30), NOTE_CLOSES_AT - 1)

    // Still commenting
    expect(inside.kind).toBe('noteOpen')

    // The moment the half hour closes
    const closed = entrantRun(entrantOf(null), boardOf(30), NOTE_CLOSES_AT)

    // Done
    expect(closed).toEqual({ kind: 'done' })
  })

  it('stops solving at a hand-in made while the clock still ran, and counts the commenting from it', () => {
    // Handed in half an hour in
    const handedInAt = STARTED_AT + 30 * MINUTE_MS

    // Read a minute later, the clock itself still having most of its time
    const run = entrantRun(entrantOf(handedInAt), boardOf(30), handedInAt + MINUTE_MS)

    // Commenting for the half hour after the hand-in
    expect(run).toEqual({
      kind: 'noteOpen',
      until: new Date(handedInAt + 30 * MINUTE_MS).toISOString(),
    })
  })

  it('stops solving at a hand-in stamped a moment ahead of the reader', () => {
    // Stamped two seconds past the instant it is read at
    const handedInAt = STARTED_AT + 30 * MINUTE_MS + 2000

    // Read before the stamp's own time
    const run = entrantRun(entrantOf(handedInAt), boardOf(30), handedInAt - 2000)

    // Commenting already, counted from the stamp
    expect(run).toEqual({
      kind: 'noteOpen',
      until: new Date(handedInAt + 30 * MINUTE_MS).toISOString(),
    })
  })

  it('counts the half hour of commenting from the clock, under a hand-in stamped after it ran out', () => {
    // Handed in ten minutes after the clock ran out, as a page left open past it can
    const handedInAt = CLOCK_ENDS_AT + 10 * MINUTE_MS

    // Read a minute after the hand-in
    const run = entrantRun(entrantOf(handedInAt), boardOf(30), handedInAt + MINUTE_MS)

    // Commenting until the half hour after the clock's end, not after the stamp
    expect(run).toEqual({ kind: 'noteOpen', until: new Date(NOTE_CLOSES_AT).toISOString() })
  })

  it('goes straight from solving to done where notes close with the entry', () => {
    // The moment the clock runs out, with no time for commenting
    const run = entrantRun(entrantOf(null), boardOf(0), CLOCK_ENDS_AT)

    // Done
    expect(run).toEqual({ kind: 'done' })
  })
})

describe('isBoardLive', () => {
  it('stays live past the close until a late starter is done', () => {
    // Long past the close, with the entrant still able to comment
    expect(isBoardLive(boardOf(30), NOTE_CLOSES_AT - 1)).toBe(true)

    // And once they are done
    expect(isBoardLive(boardOf(30), NOTE_CLOSES_AT)).toBe(false)
  })

  it('stays live past the close while a clock started at the close could still run', () => {
    // A board whose only entrant handed in long ago, leaving nobody on it to wait for
    const board = boardOf(0, entrantOf(STARTED_AT + MINUTE_MS))

    // A minute before a clock started at the very close would stop, a student not on the board yet may still write
    expect(isBoardLive(board, CLOSES_AT + 119 * MINUTE_MS)).toBe(true)

    // And once it would have stopped, nobody can
    expect(isBoardLive(board, CLOSES_AT + 120 * MINUTE_MS)).toBe(false)
  })
})
