import { describe, expect, it } from 'vitest'

import { entryBlockerFor, headerBlocker } from '../entry-reader'
import type { EntryReadiness, HostedCompetitionGroup } from '../hosted-competition-types'

/**
 * Builds a group from the one field that decides whether anybody is graded on it.
 *
 * @param closesAt - When it stops taking entries, or null for the practice one.
 *
 * @returns The group.
 */
function groupOf(closesAt: string | null): HostedCompetitionGroup {
  // Nothing below reads any of the rest, so they stay at whatever a group would hold
  return {
    id: 'group',
    name: { sk: 'Skupina', cs: 'Skupina', en: 'Group' },
    problemCount: 3,
    clockMinutes: 120,
    opensAt: '2026-09-01T00:00:00Z',
    closesAt,
    competitions: [],
  }
}

/** A group somebody is graded on, which asks the most of a reader. */
const GRADED = groupOf('2026-09-14T00:00:00Z')

/** The group nobody is graded on. */
const PRACTICE = groupOf(null)

/** A student who has claimed nothing a result of theirs could be published under. */
const UNFILLED: EntryReadiness = {
  hasUsername: false,
  hasAnsweredGraduation: false,
  hasEmail: false,
  hasAcceptedRules: false,
  hasHiddenProfilePrompt: false,
}

describe('entryBlockerFor, on a graded group', () => {
  // A student holding everything an entry asks of them
  const READY: EntryReadiness = {
    hasUsername: true,
    hasAnsweredGraduation: true,
    hasEmail: true,
    hasAcceptedRules: true,
    hasHiddenProfilePrompt: false,
  }

  it('says nothing about a reader nobody has settled yet', () => {
    // A gate drawn before the answer lands is a gate the answer may well take back
    expect(entryBlockerFor({ kind: 'unknown' }, GRADED, false)).toBeUndefined()
  })

  it('asks for an account before it asks for anything to put in one', () => {
    // Nothing else can be asked of a reader the program has never met
    expect(entryBlockerFor({ kind: 'signedOut' }, GRADED, false)).toBe('signIn')
  })

  it('asks for whichever field a result of theirs would be missing', () => {
    // The name withheld on its own
    expect(
      entryBlockerFor(
        { kind: 'signedIn', readiness: { ...READY, hasUsername: false } },
        GRADED,
        false
      )
    ).toBe('profile')

    // The graduation answer withheld on its own
    expect(
      entryBlockerFor(
        { kind: 'signedIn', readiness: { ...READY, hasAnsweredGraduation: false } },
        GRADED,
        false
      )
    ).toBe('profile')

    // The email address withheld on its own
    expect(
      entryBlockerFor({ kind: 'signedIn', readiness: { ...READY, hasEmail: false } }, GRADED, false)
    ).toBe('profile')
  })

  it('holds the gate shut on a profile nothing could be read out of', () => {
    // An answer nobody got would otherwise open the entry to somebody the results could not name
    expect(entryBlockerFor({ kind: 'unread' }, GRADED, false)).toBe('profile')
  })

  it('lets a student through without the rules, which the entry itself takes', () => {
    // Accepting them is part of the first entry rather than a condition of reaching one
    expect(
      entryBlockerFor(
        { kind: 'signedIn', readiness: { ...READY, hasAcceptedRules: false } },
        GRADED,
        false
      )
    ).toBeNull()
  })
})

describe('entryBlockerFor', () => {
  it('waives the profile for a reader no result will ever name', () => {
    // An account with none of the fields filled in, at a group that will be graded
    const unfilled = { kind: 'signedIn', readiness: UNFILLED } as const

    // Held, as everybody else is
    expect(entryBlockerFor(unfilled, GRADED, false)).toBe('profile')

    // And let through once the site lets them past the gates: the fields exist to name a student in a
    // result, and this one is never in one
    expect(entryBlockerFor(unfilled, GRADED, true)).toBeNull()
  })

  it('asks a reader let past the gates for an account all the same', () => {
    // An entry has to belong to somebody, which no grant can supply
    expect(entryBlockerFor({ kind: 'signedOut' }, GRADED, true)).toBe('signIn')
  })

  it('waives the profile on the group no result is ever published from', () => {
    // The fields exist to name a student in a result, and the practice group produces none
    expect(entryBlockerFor({ kind: 'signedIn', readiness: UNFILLED }, PRACTICE, false)).toBeNull()

    // The same student is still held at a group that will be graded
    expect(
      entryBlockerFor(
        { kind: 'signedIn', readiness: UNFILLED },
        groupOf('2026-09-14T00:00:00Z'),
        false
      )
    ).toBe('profile')
  })

  it('still wants an account for the practice group, which an entry has to belong to', () => {
    // Waiving the fields is not waiving the row they would hang off
    expect(entryBlockerFor({ kind: 'signedOut' }, PRACTICE, false)).toBe('signIn')
  })

  it('lets a profile nobody could read through to the practice group', () => {
    // Nothing the failed read would have said could have been asked for here anyway
    expect(entryBlockerFor({ kind: 'unread' }, PRACTICE, false)).toBeNull()
  })

  it('holds the graded gate shut on a student who hid the sentence about it', () => {
    // Hiding it settles what the page says, so a press still has to say what the entry wants
    expect(
      entryBlockerFor(
        { kind: 'signedIn', readiness: { ...UNFILLED, hasHiddenProfilePrompt: true } },
        GRADED,
        false
      )
    ).toBe('profile')
  })
})

describe('headerBlocker', () => {
  it('names no step for a reader let past the gates', () => {
    // The header's sentence is the same question the press asks, so it has to answer the same way
    expect(headerBlocker({ kind: 'signedIn', readiness: UNFILLED }, [GRADED], true)).toBeNull()
  })

  it('says nothing about a profile when nothing on the board is graded', () => {
    // The board the program opens on, before the first graded group is announced
    expect(headerBlocker({ kind: 'signedIn', readiness: UNFILLED }, [PRACTICE], false)).toBeNull()

    // The same reader, once there is something the fields would be published under
    expect(
      headerBlocker({ kind: 'signedIn', readiness: UNFILLED }, [PRACTICE, GRADED], false)
    ).toBe('profile')
  })

  it('still asks a practice-only board for an account', () => {
    // An entry belongs to somebody whatever it is taken into, so that step is never about the board
    expect(headerBlocker({ kind: 'signedOut' }, [PRACTICE], false)).toBe('signIn')
  })

  it('stops naming a profile the reader has asked to stop hearing about', () => {
    // Hiding it settles what the header says
    expect(
      headerBlocker(
        { kind: 'signedIn', readiness: { ...UNFILLED, hasHiddenProfilePrompt: true } },
        [GRADED],
        false
      )
    ).toBeNull()

    // And nothing else, so a reader without an account is still sent to one
    expect(headerBlocker({ kind: 'signedOut' }, [GRADED], false)).toBe('signIn')
  })
})
