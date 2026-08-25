import { describe, expect, it } from 'vitest'

import type { DefenseComposerInput } from '../defense-composer-state'
import { resolveComposerState } from '../defense-composer-state'

describe('resolveComposerState', () => {
  /** A signed-in reader whose conversation is settled and has room left in it. */
  const READY: DefenseComposerInput = {
    isConversationReady: true,
    isAuthSettled: true,
    isSignedIn: true,
    isConsentLoading: false,
    hasConsented: true,
    isThinking: false,
    repliesLeft: 12,
  }

  it('waits while the reader has not been asked to acknowledge anything yet', () => {
    // The gate has to be shut until the answer lands, since an answer nobody got is not a yes
    expect(resolveComposerState({ ...READY, isConsentLoading: true })).toEqual({ kind: 'loading' })
  })

  it('waits while the reader is still being identified', () => {
    // Rendering the sign-in prompt here would show it to a reader who is signed in, for as long as their
    // account takes to load
    expect(resolveComposerState({ ...READY, isAuthSettled: false })).toEqual({ kind: 'loading' })
  })

  it('asks for an account before it asks for anything else', () => {
    // There is nobody to write the turn as, which no acknowledgement could fix
    expect(resolveComposerState({ ...READY, isSignedIn: false, hasConsented: false })).toEqual({
      kind: 'signInRequired',
    })
  })

  it('asks the reader to acknowledge what the examiner is before handing them the editor', () => {
    // The one gate with nothing else standing for it: a reader past it looks exactly like one who was
    // never asked
    expect(resolveComposerState({ ...READY, hasConsented: false })).toEqual({
      kind: 'consentRequired',
    })
  })

  it('asks for an account ahead of saying the conversation is spent', () => {
    // A reader with no account has no conversation of their own to have spent, so telling them one is
    // full names somebody else's, and leaves them nothing to press
    expect(
      resolveComposerState({ ...READY, isSignedIn: false, hasConsented: false, repliesLeft: 0 })
    ).toEqual({ kind: 'signInRequired' })
  })

  it('closes a conversation that has spent every turn it was given', () => {
    // Nothing left to write into, and saying so beats an editor whose send would be refused
    expect(resolveComposerState({ ...READY, repliesLeft: 0 })).toEqual({ kind: 'full' })
  })

  it('stays open on the last turn while its reply is still coming', () => {
    // Closing here would take the stop button away mid-flight, from the one turn most likely to want it
    expect(resolveComposerState({ ...READY, repliesLeft: 0, isThinking: true })).toEqual({
      kind: 'open',
      repliesLeft: 0,
    })
  })

  it('opens without saying how much room is left when nothing knows the caps', () => {
    // The warning is a number, so a composer with no number to show simply does not show one
    expect(resolveComposerState({ ...READY, repliesLeft: null })).toEqual({
      kind: 'open',
      repliesLeft: null,
    })
  })
})
