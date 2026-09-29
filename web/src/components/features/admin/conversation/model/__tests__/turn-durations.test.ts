import { describe, expect, it } from 'vitest'

import type { StoredTurn, TurnRole } from '@/components/features/defense/model/defense-types'

import type { DefenseTurnAttempt } from '../admin-conversation'
import { resolveTurnDurationsMs } from '../turn-durations'

/**
 * A stored turn with only what the timings read.
 *
 * @param id - The turn's id.
 * @param role - Who authored it.
 * @param createdAt - When it was recorded.
 *
 * @returns The turn.
 */
function turn(id: string, role: TurnRole, createdAt: string): StoredTurn {
  // The body stays empty, since no timing reads it
  return { id, role, createdAt, content: '' }
}

/**
 * A draft with only its duration, which is all the timings read of it.
 *
 * @param durationMs - How long the draft took.
 *
 * @returns The draft.
 */
function draft(durationMs: number): DefenseTurnAttempt {
  // The rest of the draft is left out, since no timing reads it
  return { durationMs } as DefenseTurnAttempt
}

/** A conversation two exchanges long, its opener and first message sharing one timestamp as a start saves them. */
const TURNS = [
  turn('opener', 'examiner', '2026-09-26T17:00:00.000Z'),
  turn('first', 'candidate', '2026-09-26T17:00:00.000Z'),
  turn('reply-1', 'examiner', '2026-09-26T17:00:09.200Z'),
  turn('second', 'candidate', '2026-09-26T17:01:57.500Z'),
  turn('reply-2', 'examiner', '2026-09-26T17:02:02.900Z'),
]

describe('resolveTurnDurationsMs', () => {
  it('times a later student message from the reply above it', () => {
    // Timings with both replies' drafts in hand, so only the student's turns are in question
    const durations = resolveTurnDurationsMs(
      TURNS,
      new Map([
        ['reply-1', [draft(9200)]],
        ['reply-2', [draft(5400)]],
      ])
    )

    // From the first reply landing to the answer arriving
    expect(durations.get('second')).toBe(108_300)
  })

  it('leaves the first student message untimed', () => {
    // Timings over the conversation, with no drafts kept
    const durations = resolveTurnDurationsMs(TURNS, new Map())

    // The first message went in with the opener, so it gets no figure rather than a zero
    expect(durations.has('first')).toBe(false)
  })

  it('adds up the drafts of a reply and leaves one without drafts untimed', () => {
    // Timings where one reply kept two drafts and the other none
    const durations = resolveTurnDurationsMs(
      TURNS,
      new Map([['reply-1', [draft(4000), draft(5200)]]])
    )

    // The drafts ran one after another
    expect(durations.get('reply-1')).toBe(9200)

    // A reply held before drafts were kept has nothing to show
    expect(durations.has('reply-2')).toBe(false)
  })
})
