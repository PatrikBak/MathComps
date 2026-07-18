import { assertNever } from '@/components/shared/utils/assert-never'
import { DEFENSE_SESSIONS_STORAGE_KEY } from '@/constants/local-storage-constants'

import type { DefenseSession, DefenseTurnRequest, StoredTurn, Turn } from '../model/defense-types'
import { FALLBACK_EXAMINER_REPLY, SCRIPTED_EXAMINER_REPLIES } from './examiner-scripts'

/**
 * The mocked backend for defense conversations.
 *
 * These functions have the shape a real endpoint would: async, with server-minted ids, and one
 * round-trip that saves the student's turn and answers it together. They resolve against a fake
 * datastore kept in the browser's local storage after a short delay.
 */

/** Simulated round-trip latency for a read or delete, in milliseconds. */
const LATENCY_MS = 220
/** Lower bound of the simulated examiner "thinking" round-trip for a turn, in milliseconds. */
const MIN_THINKING_MS = 900
/** Upper bound of the simulated examiner "thinking" round-trip for a turn, in milliseconds. */
const MAX_THINKING_MS = 1400

/**
 * Waits out the fixed read/delete latency.
 *
 * @returns A promise that resolves once the latency elapses.
 */
function simulateLatency(): Promise<void> {
  // Resolve after the fixed round-trip delay
  return new Promise((resolve) => setTimeout(resolve, LATENCY_MS))
}

/**
 * The rejection an aborted request raises: the DOMException a real fetch signals when its abort fires.
 *
 * @returns The abort error.
 */
function abortError(): DOMException {
  // The shape a real fetch's abort rejection takes
  return new DOMException('Aborted', 'AbortError')
}

/**
 * Waits out the simulated examiner "thinking" round-trip, rejecting the moment the turn is stopped.
 *
 * @param signal - Aborts the wait when the student stops the turn.
 *
 * @returns A promise that resolves once the round-trip elapses.
 */
function simulateThinking(signal: AbortSignal): Promise<void> {
  // A random duration inside the thinking window so replies vary
  const delay = MIN_THINKING_MS + Math.random() * (MAX_THINKING_MS - MIN_THINKING_MS)

  // Resolve when the window elapses, or reject the moment the turn is stopped
  return new Promise((resolve, reject) => {
    // Already stopped before the wait even starts
    if (signal.aborted) {
      reject(abortError())
      return
    }

    // Resolve once the thinking window elapses
    const timer = setTimeout(() => {
      signal.removeEventListener('abort', onAbort)
      resolve()
    }, delay)

    // Reject with an abort error the moment the student stops the turn
    function onAbort() {
      clearTimeout(timer)
      reject(abortError())
    }

    // Fire the handler once on abort
    signal.addEventListener('abort', onAbort, { once: true })
  })
}

/**
 * Reads every stored session out of the fake datastore.
 *
 * @returns Every stored session.
 */
function readStore(): DefenseSession[] {
  // No datastore off the browser (server render)
  if (typeof window === 'undefined') {
    return []
  }

  // Pull the raw payload; absent means an empty store
  const raw = window.localStorage.getItem(DEFENSE_SESSIONS_STORAGE_KEY)
  if (!raw) {
    return []
  }

  // Parse it back into sessions, tolerating a corrupted or wrong-shaped payload
  try {
    const parsed: unknown = JSON.parse(raw)
    return Array.isArray(parsed) ? (parsed as DefenseSession[]) : []
  } catch {
    return []
  }
}

/**
 * Writes the full set of sessions back to the fake datastore.
 *
 * @param sessions - The full set of sessions to persist.
 */
function writeStore(sessions: DefenseSession[]): void {
  // Nothing to persist to off the browser
  if (typeof window === 'undefined') {
    return
  }

  // Serialize the whole set under the store key
  window.localStorage.setItem(DEFENSE_SESSIONS_STORAGE_KEY, JSON.stringify(sessions))
}

/**
 * Stamps turns with a persist-time timestamp.
 *
 * @param turns - The turns to stamp.
 * @param now - The ISO-8601 timestamp to stamp them with.
 *
 * @returns The stored turns.
 */
function stampTurns(turns: Turn[], now: string): StoredTurn[] {
  // Every turn gets the write moment
  return turns.map((turn) => ({ ...turn, createdAt: now }))
}

/**
 * Picks the examiner's scripted reply for a transcript: the probe matching how many student turns have
 * landed, falling back once the scripted sequence is exhausted so the conversation never dead-ends.
 *
 * A mocked stand-in for the real engine: it ignores the actual mathematics.
 *
 * @param turns - The conversation so far, oldest first.
 *
 * @returns The reply text.
 */
function selectExaminerReply(turns: Turn[]): string {
  // How many student turns have landed
  const studentTurnCount = turns.filter((turn) => turn.role === 'student').length

  // The probe for this turn, or the fallback past the scripted sequence
  return SCRIPTED_EXAMINER_REPLIES[studentTurnCount - 1] ?? FALLBACK_EXAMINER_REPLY
}

/**
 * Lists a problem's defense sessions, oldest first.
 *
 * @param problemKey - The anchor slug of the problem whose sessions these are.
 * @returns The sessions held about the given problem.
 */
export async function listSessions(problemKey: string): Promise<DefenseSession[]> {
  // Mimic the network round-trip
  await simulateLatency()

  // Only the sessions for this problem, in creation order
  return readStore().filter((session) => session.problemKey === problemKey)
}

/**
 * Advances a defense conversation by one turn: saves the student's turn, answers it, and saves the
 * reply, all in one round-trip. The first turn mints the session, opening on the examiner's greeting;
 * later turns append to it.
 *
 * @param request - The turn to submit and the context to answer it over.
 * @returns The updated session.
 */
export async function submitTurn(request: DefenseTurnRequest): Promise<DefenseSession> {
  // Wait out the round-trip, bailing the moment the turn is stopped
  await simulateThinking(request.signal)

  // A manual failure trigger: typing "!fail" in a turn fails the round-trip
  if (request.content.includes('!fail')) {
    throw new Error('TEMP round-trip failure')
  }

  // Stamp the write moment once for the new turns
  const now = new Date().toISOString()

  // The student's turn
  const studentTurn: Turn = { role: 'student', content: request.content }

  // Open a new session, or grow the one named
  switch (request.kind) {
    // Mint a fresh session, opening on the examiner's greeting
    case 'start': {
      // The greeting the fresh session opens on
      const openerTurn: Turn = { role: 'examiner', content: request.opener }

      // The examiner's reply over the greeting and the student's turn
      const replyTurn: Turn = {
        role: 'examiner',
        content: selectExaminerReply([openerTurn, studentTurn]),
      }

      // Assemble the new session under the id the request supplies
      const session: DefenseSession = {
        id: request.id,
        problemKey: request.problemKey,
        turns: stampTurns([openerTurn, studentTurn, replyTurn], now),
      }

      // Append it to the datastore
      writeStore([...readStore(), session])

      // Hand the saved session back to the caller
      return session
    }
    // Append the turn to the open session
    case 'continue': {
      // The current datastore
      const sessions = readStore()

      // Locate the open session
      const target = sessions.find((session) => session.id === request.sessionId)

      // No session carries that id
      if (!target) {
        throw new Error(`Defense session ${request.sessionId} not found`)
      }

      // The examiner's reply over the session's transcript and the student's turn
      const replyTurn: Turn = {
        role: 'examiner',
        content: selectExaminerReply([...target.turns, studentTurn]),
      }

      // Fold the new turns into the session
      const updated: DefenseSession = {
        ...target,
        turns: [...target.turns, ...stampTurns([studentTurn, replyTurn], now)],
      }

      // Write the whole set back with the target replaced
      writeStore(sessions.map((session) => (session.id === request.sessionId ? updated : session)))

      // Hand the saved session back to the caller
      return updated
    }
    // Every request kind is handled above
    default:
      return assertNever(request)
  }
}

/**
 * Deletes a session.
 *
 * @param sessionId - The id of the session to delete.
 */
export async function deleteSession(sessionId: string): Promise<void> {
  // Mimic the network round-trip
  await simulateLatency()

  // Write back every session except the deleted one
  writeStore(readStore().filter((session) => session.id !== sessionId))
}
