import { describe, expect, it } from 'vitest'

import type { DefenseTarget } from '../defense-target'
import {
  defenseDraftStorageKey,
  defenseTargetKey,
  isSubjectReachable,
  toWireTarget,
} from '../defense-target'

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

describe('isSubjectReachable', () => {
  it('reaches a competition problem whatever language the reader is in', () => {
    // The competition area hands the statement in with the problem, so there is nothing left to look up
    expect(isSubjectReachable(COMPETITION, 'sk')).toBe(true)
    expect(isSubjectReachable(COMPETITION, 'en')).toBe(true)
  })

  it('reaches nothing for a handout the site does not carry', () => {
    // A target outlives the handout it points at, and a fresh conversation about one has no subject
    expect(isSubjectReachable(HANDOUT, 'sk')).toBe(false)
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

describe('defenseTargetKey', () => {
  /**
   * Reads what the API would be able to tell about a target, in a form two of them can be compared by.
   *
   * The wire shape is a flat record of ids, so sorting its entries settles the comparison whatever order
   * the arm that built it wrote them in.
   *
   * @param target - The target being read.
   *
   * @returns The comparable form.
   */
  function wireIdentity(target: DefenseTarget): string {
    return JSON.stringify(Object.entries(toWireTarget(target)).sort())
  }

  it('names a handout defense by its handout and the environment within it', () => {
    // Both ids are in the key, so two environments of one handout are two defenses
    expect(defenseTargetKey(HANDOUT)).toContain('inverses-mod-p')
    expect(defenseTargetKey(HANDOUT)).toContain('ab12cd34')
  })

  it('names a competition defense by the archive problem alone', () => {
    // The problem id is the whole of what a first turn writes under
    expect(defenseTargetKey(COMPETITION)).toContain('open-intermediate-p2')
  })

  it('keys the same problem alike for two readers', () => {
    // The reader is not on the wire, so one student's key is another's
    expect(defenseTargetKey({ ...COMPETITION, readerKey: 'user_9zzz' })).toBe(
      defenseTargetKey(COMPETITION)
    )

    // And a reader the program has lost track of keys the same, so a session expiring mid-chat does not
    // throw away the transcript the student is part-way through arguing
    expect(defenseTargetKey({ ...COMPETITION, readerKey: null })).toBe(
      defenseTargetKey(COMPETITION)
    )
  })

  it('keys the same problem alike whichever competition it was read inside', () => {
    // A competition is where a problem was met, not what is being defended
    expect(defenseTargetKey({ ...COMPETITION, competitionId: 'winter-senior' })).toBe(
      defenseTargetKey(COMPETITION)
    )
  })

  it('tells two problems apart, and two environments of one handout', () => {
    // Two problems of one competition are two defenses
    expect(defenseTargetKey({ ...COMPETITION, problemId: 'open-intermediate-p3' })).not.toBe(
      defenseTargetKey(COMPETITION)
    )

    // As are two environments of one handout, and sharing a key would hand one the other's conversation
    expect(
      defenseTargetKey({
        kind: 'handout',
        environment: { handoutContentId: 'inverses-mod-p', environmentId: 'ef56gh78' },
      })
    ).not.toBe(defenseTargetKey(HANDOUT))
  })

  it('keeps ids apart that a joined key would run together', () => {
    // An environment whose own id holds the separator
    const split = defenseTargetKey({
      kind: 'handout',
      environment: { handoutContentId: 'a', environmentId: 'b:c' },
    })

    // And a different environment whose ids run to the same letters either side of it
    const otherSplit = defenseTargetKey({
      kind: 'handout',
      environment: { handoutContentId: 'a:b', environmentId: 'c' },
    })

    // The key has to keep the boundary the ids themselves have lost
    expect(split).not.toBe(otherSplit)
  })

  it('keys two targets alike exactly when the API cannot tell them apart', () => {
    // Every way one target here differs from another: the reader, the competition, the problem, the
    // handout and the environment within it
    const targets: DefenseTarget[] = [
      COMPETITION,
      { ...COMPETITION, readerKey: null },
      { ...COMPETITION, competitionId: 'winter-senior' },
      { ...COMPETITION, problemId: 'open-intermediate-p3' },
      HANDOUT,
      {
        kind: 'handout',
        environment: { handoutContentId: 'inverses-mod-p', environmentId: 'ef56gh78' },
      },
      {
        kind: 'handout',
        environment: { handoutContentId: 'pigeonhole', environmentId: 'ab12cd34' },
      },
    ]

    // The property the mount rule rests on: the key stands in for the wire target and for nothing else,
    // so it changes when a conversation would be written somewhere new and holds still when it would not
    for (const target of targets) {
      for (const other of targets) {
        expect(defenseTargetKey(target) === defenseTargetKey(other)).toBe(
          wireIdentity(target) === wireIdentity(other)
        )
      }
    }
  })
})
