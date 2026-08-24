import { describe, expect, it } from 'vitest'

import type { Turn } from '../../model/defense-types'
import { findFirstUncountedTurnId } from '../use-defense-competition-mode'

describe('findFirstUncountedTurnId', () => {
  /** When the entry being read stops covering what is said. */
  const ENDS_AT = '2026-09-20T12:00:00.000Z'

  /**
   * Builds one saved turn.
   *
   * @param id - What names it.
   * @param createdAt - When it was authored, as an ISO-8601 string.
   *
   * @returns The turn.
   */
  function saved(id: string, createdAt: string): Turn {
    return { id, createdAt, role: 'candidate', content: 'x' }
  }

  /**
   * Builds one turn the backend has not taken yet.
   *
   * @returns The draft.
   */
  function draft(): Turn {
    return { id: null, createdAt: null, role: 'candidate', content: 'x' }
  }

  it('marks nothing in a conversation nobody has held', () => {
    // A line drawn through an empty transcript would sit above nothing
    expect(findFirstUncountedTurnId([], ENDS_AT)).toBeNull()
  })

  it('marks nothing when the clock covered every word of it', () => {
    // This is the ordinary entry: finished inside its own time, with nothing to set apart
    const turns = [saved('a', '2026-09-20T11:00:00.000Z'), saved('b', '2026-09-20T11:59:59.000Z')]

    // Every word of it counted, so there is nothing to set apart
    expect(findFirstUncountedTurnId(turns, ENDS_AT)).toBeNull()
  })

  it('marks the first turn past the instant rather than the last one before it', () => {
    // The line goes above what stopped counting, not below what still did
    const turns = [
      saved('before', '2026-09-20T11:58:00.000Z'),
      saved('after', '2026-09-20T12:00:01.000Z'),
      saved('later', '2026-09-20T12:05:00.000Z'),
    ]

    // The earliest one the entry no longer covers, with the rest of the tail below it
    expect(findFirstUncountedTurnId(turns, ENDS_AT)).toBe('after')
  })

  it('leaves a turn recorded on the instant itself counted', () => {
    // A clock a student beat by nothing at all is a clock they beat
    const turns = [saved('exact', '2026-09-20T12:00:00.000Z')]

    // Counted, so the transcript reads as one piece
    expect(findFirstUncountedTurnId(turns, ENDS_AT)).toBeNull()
  })

  it('skips a draft the backend has not taken yet, wherever it sits', () => {
    // A turn nobody has recorded happened at no particular time, so it cannot be the one that stopped
    // counting, and the transcript has no id to hang the line off either
    const turns = [
      draft(),
      saved('before', '2026-09-20T11:00:00.000Z'),
      draft(),
      saved('after', '2026-09-20T12:30:00.000Z'),
    ]

    // The first recorded turn past the instant, the drafts around it passed over
    expect(findFirstUncountedTurnId(turns, ENDS_AT)).toBe('after')
  })

  it('marks nothing when the only uncounted turn carries no id', () => {
    // The transcript draws the line by matching an id, so a turn without one cannot carry it
    const turns: Turn[] = [
      { id: null, createdAt: '2026-09-20T12:30:00.000Z', role: 'candidate', content: 'x' },
    ]

    // Nothing the line can be hung off, so none is drawn
    expect(findFirstUncountedTurnId(turns, ENDS_AT)).toBeNull()
  })

  it('marks the very first turn when the whole conversation happened after the clock', () => {
    // Somebody who opened this problem only once their time was spent, which the line has to sit above
    const turns = [
      saved('first', '2026-09-20T12:10:00.000Z'),
      saved('second', '2026-09-20T12:20:00.000Z'),
    ]

    // The line sits at the very top, above the whole conversation
    expect(findFirstUncountedTurnId(turns, ENDS_AT)).toBe('first')
  })
})
