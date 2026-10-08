import { assertNever } from '@/components/shared/utils/assert-never'

import type { DefenseHistoryRead, DefenseOpeningStatus } from './defense-opening'
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
 * This problem's defense history could not be read, so the conversation to write into is out of reach.
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
  /** How far this problem's defense history has been read. */
  history: DefenseHistoryRead['kind']
  /** Where the conversation the chat opens on stands. */
  opening: DefenseOpeningStatus['kind']
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

  // Where this problem's defense history stands
  switch (input.history) {
    // Nothing came back, so there is neither a conversation to carry on nor a cap to write against
    case 'unreadable':
      return { kind: 'conversationUnavailable' }

    // Still coming, or in hand: either way the opening below is what decides
    case 'awaited':
    case 'inHand':
      break

    // Every standing is handled above
    default:
      return assertNever(input.history)
  }

  // Where the conversation being opened stands
  switch (input.opening) {
    // Not known yet, and a turn sent now could open a second conversation beside the one being carried on
    case 'waiting':
      return { kind: 'loading' }

    // Never to be known, the history that decides it having failed
    case 'unreachable':
      return { kind: 'conversationUnavailable' }

    // Known, so on to the reader's acknowledgement
    case 'decided':
      break

    // Every standing is handled above
    default:
      return assertNever(input.opening)
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
