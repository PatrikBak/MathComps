/**
 * The conversation is not ready to be written into yet.
 */
type ComposerLoading = {
  /** The discriminant. */
  kind: 'loading'
}

/**
 * Nobody is signed in, so there is nothing to write a turn against.
 */
type ComposerSignInRequired = {
  /** The discriminant. */
  kind: 'signInRequired'
}

/**
 * The student has not yet acknowledged what talking to the examiner entails.
 */
type ComposerConsentRequired = {
  /** The discriminant. */
  kind: 'consentRequired'
}

/**
 * The conversation has spent every turn it was given.
 */
type ComposerFull = {
  /** The discriminant. */
  kind: 'full'
}

/**
 * The conversation is open and the next turn can be written.
 */
type ComposerOpen = {
  /** The discriminant. */
  kind: 'open'
  /** How many turns are left, or null while the caps are not known. */
  repliesLeft: number | null
}

/**
 * What the composer area currently is: a wait, a gate, a spent conversation, or a live editor.
 */
export type DefenseComposerState =
  | ComposerLoading
  | ComposerSignInRequired
  | ComposerConsentRequired
  | ComposerFull
  | ComposerOpen

/**
 * What the composer is being asked to be.
 */
export type DefenseComposerInput = {
  /** Whether the conversation it writes into has settled. */
  isConversationReady: boolean
  /** Whether the reader's account is known one way or the other. */
  isAuthSettled: boolean
  /** Whether the reader has an account. */
  isSignedIn: boolean
  /** Whether the reader's acknowledgement is still being read. */
  isConsentLoading: boolean
  /** Whether the reader has acknowledged what talking to the examiner entails. */
  hasConsented: boolean
  /** Whether the account gates are waived, which is what a mocked reader is let through on. */
  isGateWaived: boolean
  /** Whether a reply is in flight. */
  isThinking: boolean
  /** How many turns the conversation has left, or null while the caps are not known. */
  repliesLeft: number | null
}

/**
 * Works out what the composer area currently is.
 *
 * @param input - What it is being asked to be.
 *
 * @returns The state to render.
 */
export function resolveComposerState(input: DefenseComposerInput): DefenseComposerState {
  // Nothing to write into yet. A waived reader waits on no acknowledgement, so that read never holds them
  if (
    !input.isConversationReady ||
    (!input.isGateWaived && (!input.isAuthSettled || input.isConsentLoading))
  ) {
    return { kind: 'loading' }
  }

  // The account gates, which a waiver skips outright
  if (!input.isGateWaived) {
    // Nobody to write the turn as
    if (!input.isSignedIn) {
      return { kind: 'signInRequired' }
    }

    // Nobody who has said what they are agreeing to
    if (!input.hasConsented) {
      return { kind: 'consentRequired' }
    }
  }

  // Every turn spent, though a reply still coming is allowed to land
  if (input.repliesLeft !== null && input.repliesLeft <= 0 && !input.isThinking) {
    return { kind: 'full' }
  }

  // Open for the next turn, with whatever room is left in it
  return { kind: 'open', repliesLeft: input.repliesLeft }
}
