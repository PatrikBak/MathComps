import { assertNever } from '@/components/shared/utils/assert-never'

import type { DefenseOpening, DefenseSession } from './defense-types'

/**
 * Where a newer read of a problem's history stands: none on its way, one on its way, or the latest one
 * having given up.
 */
export type HistoryRefresh = 'none' | 'coming' | 'failed'

/**
 * Nothing of a problem's history is in hand yet, and a read of it is still to come.
 */
type HistoryAwaited = {
  /** The discriminant. */
  kind: 'awaited'
}

/**
 * Nothing of a problem's history is in hand, and the read of it gave up.
 */
type HistoryUnreadable = {
  /** The discriminant. */
  kind: 'unreadable'
}

/**
 * A problem's history is in hand, as of the last read that got through.
 */
type HistoryInHand = {
  /** The discriminant. */
  kind: 'inHand'
  /** The conversations saved against the problem, most recently active first. */
  sessions: readonly DefenseSession[]
  /** Whether it is known to miss a write made since it was read. */
  isOutdated: boolean
  /** Where a newer read of it stands. */
  refresh: HistoryRefresh
}

/**
 * What is known of the conversations saved against a problem.
 */
export type DefenseHistoryRead = HistoryAwaited | HistoryUnreadable | HistoryInHand

/**
 * The conversation to open on is not known yet, since the history that decides it is still to come.
 */
type OpeningWaiting = {
  /** The discriminant. */
  kind: 'waiting'
}

/**
 * The conversation to open on cannot be known, since the history that decides it could not be read.
 */
type OpeningUnreachable = {
  /** The discriminant. */
  kind: 'unreachable'
}

/**
 * The conversation to open on is known.
 */
export type OpeningDecided = {
  /** The discriminant. */
  kind: 'decided'
  /** The saved conversation to carry on, or null for a blank one. */
  conversation: DefenseSession | null
}

/**
 * Where the conversation a chat opens on stands.
 */
export type DefenseOpeningStatus = OpeningWaiting | OpeningUnreachable | OpeningDecided

/**
 * An opening that carries on a saved conversation, so the history decides which one.
 */
type SavedOpening = Exclude<DefenseOpening, { kind: 'fresh' }>

/**
 * What a history in hand says about the conversation an opening asks for.
 */
type HistoryReading = {
  /** The saved conversation it would open on, or null when it holds none to open. */
  conversation: DefenseSession | null
  /** Whether the history in hand settles that, so no newer read could change it. */
  isSettled: boolean
}

/**
 * Works out which conversation a chat opens on, as far as what is known of the problem's history decides it.
 *
 * @param opening - Which conversation the chat was asked to open on.
 * @param history - What is known of the conversations saved against the problem.
 *
 * @returns Whether the conversation is known, still to be learned, or out of reach.
 */
export function resolveOpening(
  opening: DefenseOpening,
  history: DefenseHistoryRead
): DefenseOpeningStatus {
  // A blank conversation asks nothing of the history
  if (opening.kind === 'fresh') {
    return { kind: 'decided', conversation: null }
  }

  // Every other opening is decided by the history, as far as it is known
  switch (history.kind) {
    // Nothing to find the conversation in yet
    case 'awaited':
      return { kind: 'waiting' }

    // Nothing to find it in at all
    case 'unreadable':
      return { kind: 'unreachable' }

    // A history to look in, which may or may not settle it
    case 'inHand':
      return resolveFromHistoryInHand(opening, history)

    // Every history is handled above
    default:
      return assertNever(history)
  }
}

/**
 * Works out which saved conversation an opening carries on, off the history in hand.
 *
 * @param opening - Which saved conversation the chat was asked to open on.
 * @param history - The history in hand.
 *
 * @returns The conversation once the history settles it, else a wait for the newer read, or the answer out
 *   of reach once that read gave up.
 */
function resolveFromHistoryInHand(
  opening: SavedOpening,
  history: HistoryInHand
): DefenseOpeningStatus {
  // What the history in hand says
  const reading = readHistoryFor(opening, history)

  // Settled by what is in hand
  if (reading.isSettled) {
    return { kind: 'decided', conversation: reading.conversation }
  }

  // Unsettled, so it rests on the newer read
  switch (history.refresh) {
    // A newer read that gave up leaves the answer out of reach
    case 'failed':
      return { kind: 'unreachable' }

    // A newer read still to come, or owed for a history known to miss a write
    case 'coming':
    case 'none':
      return { kind: 'waiting' }

    // Every refresh is handled above
    default:
      return assertNever(history.refresh)
  }
}

/**
 * Reads the conversation an opening asks for out of the history in hand.
 *
 * @param opening - Which saved conversation the chat was asked to open on.
 * @param history - The history in hand.
 *
 * @returns The conversation it holds for the opening, and whether a newer read could change that.
 */
function readHistoryFor(opening: SavedOpening, history: HistoryInHand): HistoryReading {
  switch (opening.kind) {
    // The most recently active one, which a write since the read may have changed. A history merely being
    // read again is taken as it stands, so a read that then gives up still opens on it
    case 'newest':
      return { conversation: history.sessions[0] ?? null, isSettled: !history.isOutdated }

    // One in particular, which settles it once found. A missing one may arrive with a newer read
    case 'named': {
      // The one asked for, if the history holds it
      const conversation =
        history.sessions.find((session) => session.id === opening.sessionId) ?? null

      // Missing for good only once nothing newer is to come
      return { conversation, isSettled: conversation !== null || !mayDifferFromNewer(history) }
    }

    // Every saved opening is handled above
    default:
      return assertNever(opening)
  }
}

/**
 * Whether a newer read of the history may hold something the one in hand does not.
 *
 * @param history - The history in hand.
 *
 * @returns True when it is known to miss a write, or a newer read has been asked for.
 */
function mayDifferFromNewer(history: HistoryInHand): boolean {
  switch (history.refresh) {
    // A newer read was asked for, whatever became of it
    case 'coming':
    case 'failed':
      return true

    // No newer read asked for, so only a write known to be missing says the history differs
    case 'none':
      return history.isOutdated

    // Every refresh is handled above
    default:
      return assertNever(history.refresh)
  }
}
