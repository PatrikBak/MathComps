import { describe, expect, it } from 'vitest'

import type { DefenseComposerInput } from '../defense-composer-state'
import {
  resolveComposerState,
  resolveConsentStatus,
  resolveHistoryStatus,
} from '../defense-composer-state'

describe('resolveComposerState', () => {
  /** A signed-in reader whose conversation is settled and has room left in it. */
  const READY: DefenseComposerInput = {
    isAuthSettled: true,
    isSignedIn: true,
    historyStatus: 'read',
    isResumeSettled: true,
    consentStatus: 'given',
    isThinking: false,
    messagesLeft: 12,
    competition: null,
  }

  it('waits while the reader has not been asked to acknowledge anything yet', () => {
    // The gate has to be shut until the answer lands, since an answer nobody got is not a yes
    expect(resolveComposerState({ ...READY, consentStatus: 'loading' })).toEqual({
      kind: 'loading',
    })
  })

  it('waits while the reader is still being identified', () => {
    // Rendering the sign-in prompt here would show it to a reader who is signed in, for as long as their
    // account takes to load
    expect(resolveComposerState({ ...READY, isAuthSettled: false })).toEqual({ kind: 'loading' })
  })

  it('asks for an account before it asks for anything else', () => {
    // There is nobody to write the turn as, which no acknowledgement could fix
    expect(resolveComposerState({ ...READY, isSignedIn: false, consentStatus: 'missing' })).toEqual(
      {
        kind: 'signInRequired',
      }
    )
  })

  it('asks a reader with no account for one rather than waiting on a read about nobody', () => {
    // The acknowledgement is never read for a reader who has no account, so treating that unread answer
    // as a wait leaves them on a spinner that nothing will ever resolve
    expect(resolveComposerState({ ...READY, isSignedIn: false, consentStatus: 'loading' })).toEqual(
      {
        kind: 'signInRequired',
      }
    )
  })

  it('asks the reader to acknowledge what the examiner is before handing them the editor', () => {
    // The one gate with nothing else standing for it: a reader past it looks exactly like one who was
    // never asked
    expect(resolveComposerState({ ...READY, consentStatus: 'missing' })).toEqual({
      kind: 'consentRequired',
    })
  })

  it('says so when it could not find out whether the reader has acknowledged anything', () => {
    // A read nobody got is not a refusal, and the gate would send them at the endpoint that just failed
    expect(resolveComposerState({ ...READY, consentStatus: 'unknown' })).toEqual({
      kind: 'consentUnknown',
    })
  })

  it('asks for an account ahead of admitting it could not read the acknowledgement', () => {
    // Nobody is signed in for the read to have been about, so its failure is not the reader's problem
    expect(resolveComposerState({ ...READY, isSignedIn: false, consentStatus: 'unknown' })).toEqual(
      {
        kind: 'signInRequired',
      }
    )
  })

  it('admits it could not read the acknowledgement ahead of saying the conversation is spent', () => {
    // The message count is beside the point while nothing can be written at all
    expect(resolveComposerState({ ...READY, consentStatus: 'unknown', messagesLeft: 0 })).toEqual({
      kind: 'consentUnknown',
    })
  })

  it('asks for an account ahead of saying the conversation is spent', () => {
    // A reader with no account has no conversation of their own to have spent, so telling them one is
    // full names somebody else's, and leaves them nothing to press
    expect(
      resolveComposerState({
        ...READY,
        isSignedIn: false,
        consentStatus: 'missing',
        messagesLeft: 0,
      })
    ).toEqual({ kind: 'signInRequired' })
  })

  it('closes a conversation that has spent every message it was given', () => {
    // Nothing left to write into, and saying so beats an editor whose send would be refused
    expect(resolveComposerState({ ...READY, messagesLeft: 0 })).toEqual({
      kind: 'full',
      isGraded: false,
    })
  })

  it('carries the grading through to a spent conversation', () => {
    // The sentence the composer shows there names a different way on, because grading takes rewind away
    expect(
      resolveComposerState({ ...READY, messagesLeft: 0, competition: { isGraded: true } })
    ).toEqual({
      kind: 'full',
      isGraded: true,
    })
  })

  it('stays open on the last message while its reply is still coming', () => {
    // Closing here would take the stop button away mid-flight, from the one turn most likely to want it
    expect(resolveComposerState({ ...READY, messagesLeft: 0, isThinking: true })).toEqual({
      kind: 'open',
      messagesLeft: 0,
    })
  })

  it('carries the full count through on a competition very first message', () => {
    // A competition's clock pushes a student to spend messages fast, so the count stands before the first
    // message is spent
    expect(
      resolveComposerState({ ...READY, messagesLeft: 30, competition: { isGraded: false } })
    ).toEqual({
      kind: 'open',
      messagesLeft: 30,
    })
  })

  it('holds the count back outside a competition until the wall is close', () => {
    // Running out costs nothing here, so a count from the first message only makes a reader ration
    // questions they should be asking
    expect(resolveComposerState({ ...READY, messagesLeft: 30 })).toEqual({
      kind: 'open',
      messagesLeft: null,
    })
  })

  it('says the count once the wall is close outside a competition', () => {
    // Cheap as it is, the wall still arrives without warning otherwise
    expect(resolveComposerState({ ...READY, messagesLeft: 5 })).toEqual({
      kind: 'open',
      messagesLeft: 5,
    })
  })

  it('waits while the conversation the reader asked to carry on is still being opened', () => {
    // A turn taken before the named conversation is open would open a second one beside it
    expect(resolveComposerState({ ...READY, isResumeSettled: false })).toEqual({
      kind: 'loading',
    })
  })

  it('says so when the defense history behind the conversation could not be read', () => {
    expect(resolveComposerState({ ...READY, historyStatus: 'unavailable' })).toEqual({
      kind: 'conversationUnavailable',
    })
  })

  it('says the history could not be read rather than waiting on the resume it would have settled', () => {
    // Waiting here is a spinner nothing ends: the read that settles the opening is the one that just
    // failed, so nothing further is coming on its own
    expect(
      resolveComposerState({ ...READY, historyStatus: 'unavailable', isResumeSettled: false })
    ).toEqual({ kind: 'conversationUnavailable' })
  })

  it('asks for an account ahead of admitting it could not read the history', () => {
    // Nobody is signed in for the read to have been about, and no conversation of theirs was ever asked for
    expect(
      resolveComposerState({ ...READY, isSignedIn: false, historyStatus: 'unavailable' })
    ).toEqual({ kind: 'signInRequired' })
  })

  it('admits it could not read the history ahead of asking for the acknowledgement', () => {
    // The acknowledgement gates a turn there is nowhere to write, and its own gate would send the reader
    // at a second endpoint when the one that failed is the one they need
    expect(
      resolveComposerState({
        ...READY,
        consentStatus: 'missing',
        historyStatus: 'unavailable',
        messagesLeft: null,
      })
    ).toEqual({ kind: 'conversationUnavailable' })
  })

  it('opens without saying how much room is left while the history is still coming', () => {
    // The warning is a number, so a composer with no number to show simply does not show one
    expect(
      resolveComposerState({ ...READY, historyStatus: 'loading', messagesLeft: null })
    ).toEqual({
      kind: 'open',
      messagesLeft: null,
    })
  })
})

describe('resolveConsentStatus', () => {
  /** When a student acknowledged what talking to the examiner entails. */
  const CONSENTED_AT = '2026-01-14T09:30:00.000Z'

  it('reads a standing acknowledgement off the answer that carries it', () => {
    expect(resolveConsentStatus({ data: { consentedAt: CONSENTED_AT }, isError: false })).toBe(
      'given'
    )
  })

  it('reads a student who has yet to acknowledge anything off the same answer', () => {
    expect(resolveConsentStatus({ data: { consentedAt: null }, isError: false })).toBe('missing')
  })

  it('keeps a standing acknowledgement through a read that failed after it', () => {
    // React Query holds the last answer alongside the failure of a later read, and that answer stands
    expect(resolveConsentStatus({ data: { consentedAt: CONSENTED_AT }, isError: true })).toBe(
      'given'
    )
  })

  it('says it could not find out when the failure is all there is', () => {
    // Nothing was ever read, so the student is neither past the gate nor short of it
    expect(resolveConsentStatus({ data: undefined, isError: true })).toBe('unknown')
  })

  it('waits while nothing has come back and nothing has failed', () => {
    expect(resolveConsentStatus({ data: undefined, isError: false })).toBe('loading')
  })
})

describe('resolveHistoryStatus', () => {
  /** The caps a defense here is held to. */
  const LIMITS = {
    maxCandidateChars: 4000,
    maxFeedbackCommentChars: 2000,
    maxMessagesPerDefense: 50,
  }

  it('reads the history off the answer that carries it', () => {
    expect(resolveHistoryStatus({ limits: LIMITS, isError: false })).toBe('read')
  })

  it('keeps the answer it has through a read that failed after it', () => {
    expect(resolveHistoryStatus({ limits: LIMITS, isError: true })).toBe('read')
  })

  it('says it could not be read when the failure is all there is', () => {
    expect(resolveHistoryStatus({ limits: null, isError: true })).toBe('unavailable')
  })

  it('waits while nothing has come back and nothing has failed', () => {
    expect(resolveHistoryStatus({ limits: null, isError: false })).toBe('loading')
  })
})
