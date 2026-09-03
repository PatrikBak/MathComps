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
 * How the read of this problem's defense history came back. One read carries both the conversations
 * saved against the problem and the caps a further one is held to.
 */
type HistoryRead = {
  /** The caps the last read that got through came back with, null while none has. */
  limits: DefenseLimits | null
  /** Whether the most recent attempt failed. */
  isError: boolean
}

/**
 * Where this problem's defense history stands: read, out of reach, or still coming.
 */
export type DefenseHistoryStatus = 'read' | 'unavailable' | 'loading'

/**
 * Reads where this problem's defense history stands off the read that asked for it.
 *
 * @param read - How the read of this problem's defense history came back.
 *
 * @returns What it establishes.
 */
export function resolveHistoryStatus(read: HistoryRead): DefenseHistoryStatus {
  // An answer already in hand, which a later read failing does not take back
  if (read.limits !== null) {
    return 'read'
  }

  // A failure with nothing behind it leaves neither a transcript to argue on top of nor a cap to hold a
  // message to
  if (read.isError) {
    return 'unavailable'
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
 * This problem's defense history could not be read, so there is neither a conversation to carry on nor a
 * cap to hold a message to.
 */
type ComposerConversationUnavailable = {
  /** The discriminant. */
  kind: 'conversationUnavailable'
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
 * The conversation has spent every message it was given.
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
 * The conversation is open and the next message can be written.
 */
type ComposerOpen = {
  /** The discriminant. */
  kind: 'open'
  /** How many messages are left, or null when that is unknown or not worth saying yet. */
  messagesLeft: number | null
}

/**
 * How few messages are left before running low is worth saying out loud. Outside a competition a count
 * carried from the first message would only make a reader ration questions they should be asking.
 */
export const MESSAGES_LEFT_TO_WARN_AT = 5

/**
 * How few messages are left before running low reads as the wall itself.
 */
export const MESSAGES_LEFT_TO_ALARM_AT = 1

/**
 * What the composer area currently is: a wait, a gate, a spent conversation, or a live editor.
 */
export type DefenseComposerState =
  | ComposerLoading
  | ComposerSignInRequired
  | ComposerConversationUnavailable
  | ComposerConsentRequired
  | ComposerConsentUnknown
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
  /** Whether the reader's account is known one way or the other. */
  isAuthSettled: boolean
  /** Whether the reader has an account. */
  isSignedIn: boolean
  /** Where this problem's defense history stands. */
  historyStatus: DefenseHistoryStatus
  /**
   * Whether the conversation asked for on open has had its chance to be opened, which a fresh opening
   * has by construction.
   */
  isResumeSettled: boolean
  /** Where the reader stands on acknowledging what talking to the examiner entails. */
  consentStatus: MathildaConsentStatus
  /** Whether a reply is in flight. */
  isThinking: boolean
  /** How many messages the conversation has left, or null while the caps are not known. */
  messagesLeft: number | null
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
  // Still working out who the reader is
  if (!input.isAuthSettled) {
    return { kind: 'loading' }
  }

  // Nobody to write the turn as, asked ahead of every read that needs an account, since none of them
  // fires for such a reader
  if (!input.isSignedIn) {
    return { kind: 'signInRequired' }
  }

  // Where this problem's defense history stands, asked ahead of the resume below, which waits on this
  // very read to settle it
  switch (input.historyStatus) {
    // Nothing came back, so there is neither a conversation to carry on nor a cap to write against
    case 'unavailable':
      return { kind: 'conversationUnavailable' }

    // Still coming, or in hand: either way the resume below is what decides
    case 'loading':
    case 'read':
      break

    // Every standing is handled above
    default:
      return assertNever(input.historyStatus)
  }

  // A conversation opened on a named defense writes nothing until its resume settles: a turn sent
  // before it would open a second defense beside the one being continued
  if (!input.isResumeSettled) {
    return { kind: 'loading' }
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

  // Every message spent, though a reply still coming is allowed to land
  if (input.messagesLeft !== null && input.messagesLeft <= 0 && !input.isThinking) {
    return { kind: 'full', isGraded: input.competition !== null && input.competition.isGraded }
  }

  // A competition says the room left from the first message, since its clock pushes a student to spend
  // messages fast and nothing undoes a conversation spent that way. Elsewhere the count waits until the
  // wall is close
  const isRoomLeftWorthSaying =
    input.messagesLeft !== null &&
    (input.competition !== null || input.messagesLeft <= MESSAGES_LEFT_TO_WARN_AT)

  // Open for the next message, carrying the count only where it is worth saying
  return { kind: 'open', messagesLeft: isRoomLeftWorthSaying ? input.messagesLeft : null }
}
