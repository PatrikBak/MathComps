import { assertNever } from '@/components/shared/utils/assert-never'

import type { MathildaConsent, MathildaConsentStatus } from './defense-types'

/**
 * How a read of the standing acknowledgement came back.
 */
type ConsentRead = {
  /** What the last read that got through came back with, undefined while none has. */
  data: MathildaConsent | undefined
  /** Whether the most recent attempt failed. */
  isError: boolean
}

/**
 * Reads where the student stands off the read that asked.
 *
 * @param read - How the read of the standing acknowledgement came back.
 *
 * @returns What it establishes.
 */
export function resolveConsentStatus(read: ConsentRead): MathildaConsentStatus {
  // An answer already in hand, which a later read failing does not take back
  if (read.data !== undefined) {
    return read.data.consentedAt != null ? 'given' : 'missing'
  }

  // A failure with nothing behind it establishes nothing
  if (read.isError) {
    return 'unknown'
  }

  // Nothing back yet, which is also where a reader with no account sits, since nothing reads for them
  return 'loading'
}

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
 * Where the student stands on what talking to the examiner entails could not be read.
 */
type ComposerConsentUnknown = {
  /** The discriminant. */
  kind: 'consentUnknown'
}

/**
 * The conversation has spent every turn it was given.
 */
type ComposerFull = {
  /** The discriminant. */
  kind: 'full'
  /**
   * Whether the conversation is being graded, which takes rewind away and leaves another conversation
   * on the problem as the way on.
   */
  isGraded: boolean
}

/**
 * The conversation is open and the next turn can be written.
 */
type ComposerOpen = {
  /** The discriminant. */
  kind: 'open'
  /** How many turns are left, or null when that is unknown or not worth saying yet. */
  repliesLeft: number | null
}

/**
 * How close to the cap an ungraded conversation gets before the room left is said out loud. Running
 * out costs nothing there, so a count carried from the first turn only makes a student ration
 * questions they should be asking.
 */
const UNGRADED_REPLIES_LEFT_TO_WARN_AT = 5

/**
 * What the composer area currently is: a wait, a gate, a spent conversation, or a live editor.
 */
export type DefenseComposerState =
  | ComposerLoading
  | ComposerSignInRequired
  | ComposerConsentRequired
  | ComposerConsentUnknown
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
  /** Where the reader stands on acknowledging what talking to the examiner entails. */
  consentStatus: MathildaConsentStatus
  /** Whether a reply is in flight. */
  isThinking: boolean
  /** How many turns the conversation has left, or null while the caps are not known. */
  repliesLeft: number | null
  /** Whether the conversation is being graded. */
  isGraded: boolean
}

/**
 * Works out what the composer area currently is.
 *
 * @param input - What it is being asked to be.
 *
 * @returns The state to render.
 */
export function resolveComposerState(input: DefenseComposerInput): DefenseComposerState {
  // Nothing to write into yet
  if (!input.isConversationReady || !input.isAuthSettled) {
    return { kind: 'loading' }
  }

  // Nobody to write the turn as, asked ahead of the acknowledgement, which never reads for such a reader
  if (!input.isSignedIn) {
    return { kind: 'signInRequired' }
  }

  // Where the reader stands on the acknowledgement
  switch (input.consentStatus) {
    // Still being read
    case 'loading':
      return { kind: 'loading' }

    // Nobody who could be asked whether they have already agreed
    case 'unknown':
      return { kind: 'consentUnknown' }

    // Nobody who has said what they are agreeing to
    case 'missing':
      return { kind: 'consentRequired' }

    // Past it, so what is left to weigh is the conversation's own room
    case 'given':
      break

    // Every standing is handled above
    default:
      return assertNever(input.consentStatus)
  }

  // Every turn spent, though a reply still coming is allowed to land
  if (input.repliesLeft !== null && input.repliesLeft <= 0 && !input.isThinking) {
    return { kind: 'full', isGraded: input.isGraded }
  }

  // A graded conversation says the room left from the first turn, because a student who runs out
  // mid-argument has no rewind to undo it; anywhere else waits until the wall is close
  const isRoomLeftWorthSaying =
    input.repliesLeft !== null &&
    (input.isGraded || input.repliesLeft <= UNGRADED_REPLIES_LEFT_TO_WARN_AT)

  // Open for the next turn, carrying the count only where it is worth saying
  return { kind: 'open', repliesLeft: isRoomLeftWorthSaying ? input.repliesLeft : null }
}
