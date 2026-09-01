import { assertNever } from '@/components/shared/utils/assert-never'

import type { DefenseLimits, MathildaConsent, MathildaConsentStatus } from './defense-types'

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
 * How a read of the caps a defense is held to came back.
 */
type CapsRead = {
  /** The caps the last read that got through came back with, null while none has. */
  limits: DefenseLimits | null
  /** Whether the most recent attempt failed. */
  isError: boolean
}

/**
 * Where the caps a defense is held to stand: read, out of reach, or still coming.
 */
export type DefenseCapsStatus = 'known' | 'unknown' | 'loading'

/**
 * Reads where the caps stand off the read that asked.
 *
 * @param read - How the read of the caps came back.
 *
 * @returns What it establishes.
 */
export function resolveCapsStatus(read: CapsRead): DefenseCapsStatus {
  // Caps already in hand, which a later read failing does not take back
  if (read.limits !== null) {
    return 'known'
  }

  // A failure with nothing behind it establishes nothing
  if (read.isError) {
    return 'unknown'
  }

  // Nothing back yet
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
 * What a turn here is held to could not be read.
 */
type ComposerCapsUnknown = {
  /** The discriminant. */
  kind: 'capsUnknown'
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
 * How few replies are left before running low is worth saying out loud. Outside a competition a count
 * carried from the first turn would only make a reader ration questions they should be asking.
 */
export const REPLIES_LEFT_TO_WARN_AT = 5

/**
 * How few replies are left before running low reads as the wall itself.
 */
export const REPLIES_LEFT_TO_ALARM_AT = 1

/**
 * What the composer area currently is: a wait, a gate, a spent conversation, or a live editor.
 */
export type DefenseComposerState =
  | ComposerLoading
  | ComposerSignInRequired
  | ComposerConsentRequired
  | ComposerConsentUnknown
  | ComposerCapsUnknown
  | ComposerFull
  | ComposerOpen

/**
 * The competition run a conversation is being argued inside, as far as the composer has to know it.
 */
type ComposerCompetitionRun = {
  /** Whether the student is graded on the run. */
  isGraded: boolean
}

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
  /** Where the caps a turn here is held to stand. */
  capsStatus: DefenseCapsStatus
  /** How many turns the conversation has left, or null while the caps are not known. */
  repliesLeft: number | null
  /** The competition run it is being argued inside, or null outside one. */
  competition: ComposerCompetitionRun | null
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

  // Where the caps a turn is held to stand
  switch (input.capsStatus) {
    // The read that carries them failed with nothing behind it, so a turn has nothing to be held to
    case 'unknown':
      return { kind: 'capsUnknown' }

    // Still coming, or in hand: either way there is an editor to write into
    case 'loading':
    case 'known':
      break

    // Every standing is handled above
    default:
      return assertNever(input.capsStatus)
  }

  // Every turn spent, though a reply still coming is allowed to land
  if (input.repliesLeft !== null && input.repliesLeft <= 0 && !input.isThinking) {
    return { kind: 'full', isGraded: input.competition !== null && input.competition.isGraded }
  }

  // A competition says the room left from the first turn, since its clock pushes a student to spend
  // turns fast and nothing undoes a conversation spent that way. Elsewhere the count waits until the
  // wall is close
  const isRoomLeftWorthSaying =
    input.repliesLeft !== null &&
    (input.competition !== null || input.repliesLeft <= REPLIES_LEFT_TO_WARN_AT)

  // Open for the next turn, carrying the count only where it is worth saying
  return { kind: 'open', repliesLeft: isRoomLeftWorthSaying ? input.repliesLeft : null }
}
