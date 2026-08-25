import { describe, expect, it } from 'vitest'

import type { DefenseTarget } from '../defense-target'
import { defenseDraftStorageKey, handoutTargetOf, toWireTarget } from '../defense-target'

/** A defense held against a problem set by a competition. */
const COMPETITION: DefenseTarget = {
  kind: 'competition',
  competitionId: 'open-intermediate',
  problemId: 'open-intermediate-p2',
  readerKey: 'user_2abc',
}

/** A defense held against one environment of a published handout. */
const HANDOUT: DefenseTarget = {
  kind: 'handout',
  environment: { handoutContentId: 'inverses-mod-p', environmentId: 'ab12cd34' },
}

describe('toWireTarget', () => {
  it('flattens a handout environment onto the two ids the API names it by', () => {
    // The server reads the discriminator and the two ids off one object, not off a nested environment
    expect(toWireTarget(HANDOUT)).toEqual({
      kind: 'handout',
      handoutContentId: 'inverses-mod-p',
      environmentId: 'ab12cd34',
    })
  })

  it('sends a competition problem as its own id under the problem kind', () => {
    // The wire knows the archive problem and nothing about the competition it was read inside
    expect(toWireTarget(COMPETITION)).toEqual({
      kind: 'problem',
      problemId: 'open-intermediate-p2',
    })
  })
})

describe('handoutTargetOf', () => {
  it('hands back the environment a handout defense is held against', () => {
    // A handout defense names an environment, which is what the reader's link to the problem resolves from
    expect(handoutTargetOf(HANDOUT)).toEqual({
      handoutContentId: 'inverses-mod-p',
      environmentId: 'ab12cd34',
    })
  })

  it('names no environment for a defense held inside a competition', () => {
    // A competition problem lives in no handout, and a request claiming one would point at nothing
    expect(handoutTargetOf(COMPETITION)).toBeNull()
  })
})

describe('defenseDraftStorageKey', () => {
  it('keeps a competition draft under its problem rather than its conversation', () => {
    // A student starting a second conversation about the same problem is still writing the same solution
    expect(defenseDraftStorageKey(COMPETITION)).toBe(
      'defense-draft:competition:user_2abc:open-intermediate:open-intermediate-p2'
    )
  })

  it("keeps two students on one browser out of one another's drafts", () => {
    // A school computer, where signing out is the only thing between one entrant and the next
    const other = defenseDraftStorageKey({ ...COMPETITION, readerKey: 'user_9zzz' })

    // Different students, different keys, whatever they are both half-way through writing
    expect(other).not.toBe(defenseDraftStorageKey(COMPETITION))
  })

  it('keeps no handout draft past the chat closing', () => {
    // Nothing is at stake in reopening a handout problem, and what is written about one would otherwise
    // outlive the browser it was written in and greet whoever reads that handout next
    expect(defenseDraftStorageKey(HANDOUT)).toBeNull()
  })
})
