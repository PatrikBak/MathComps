import { describe, expect, it } from 'vitest'

import { entryBlocker } from '../entry-reader'
import type { EntryReadiness } from '../hosted-competition-types'

describe('entryBlocker', () => {
  // A student holding everything an entry asks of them
  const READY: EntryReadiness = {
    hasUsername: true,
    hasAnsweredGraduation: true,
    hasEmail: true,
    hasAcceptedRules: true,
  }

  it('says nothing about a reader nobody has settled yet', () => {
    // A gate drawn before the answer lands is a gate the answer may well take back
    expect(entryBlocker({ kind: 'unknown' })).toBeUndefined()
  })

  it('asks for an account before it asks for anything to put in one', () => {
    // Nothing else can be asked of a reader the program has never met
    expect(entryBlocker({ kind: 'signedOut' })).toBe('signIn')
  })

  it('asks for whichever field a result of theirs would be missing', () => {
    // The name withheld on its own
    expect(entryBlocker({ kind: 'signedIn', readiness: { ...READY, hasUsername: false } })).toBe(
      'profile'
    )

    // The graduation answer withheld on its own
    expect(
      entryBlocker({ kind: 'signedIn', readiness: { ...READY, hasAnsweredGraduation: false } })
    ).toBe('profile')

    // The email address withheld on its own
    expect(entryBlocker({ kind: 'signedIn', readiness: { ...READY, hasEmail: false } })).toBe(
      'profile'
    )
  })

  it('holds the gate shut on a profile nothing could be read out of', () => {
    // An answer nobody got would otherwise open the entry to somebody the results could not name
    expect(entryBlocker({ kind: 'unread' })).toBe('profile')
  })

  it('lets a student through without the rules, which the entry itself takes', () => {
    // Accepting them is part of the first entry rather than a condition of reaching one
    expect(
      entryBlocker({ kind: 'signedIn', readiness: { ...READY, hasAcceptedRules: false } })
    ).toBeNull()
  })
})
