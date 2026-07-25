import { describe, expect, it } from 'vitest'

import { BackendApiError } from '@/lib/api/api-error'

import {
  DefenseConversationModel,
  type DefenseConversationServices,
} from '../defense-conversation-model'
import type {
  DefenseProblem,
  DefenseSession,
  DefenseTurnRequest,
  StoredTurn,
  Turn,
} from '../defense-types'

/** The problem every test defends. */
const SAMPLE_PROBLEM: DefenseProblem = {
  target: { handoutContentId: 'handout-1', environmentId: 'p1' },
  statement: 'Prove it.',
  reference: 'Because.',
  hints: [],
}

/** The examiner's opening line. */
const OPENER = 'Walk me through your argument.'

/**
 * Drains every pending microtask so the model's async chains settle up to their next suspension point.
 *
 * @returns A promise that resolves after the microtask queue empties.
 */
function flush(): Promise<void> {
  // A macrotask runs only after all microtasks have drained
  return new Promise((resolve) => setTimeout(resolve, 0))
}

/**
 * Stamps turns with a fixed timestamp, standing in for the backend's persist-time dating.
 *
 * @param turns - The turns to stamp.
 *
 * @returns The stored turns.
 */
function stampTurns(turns: Turn[]): StoredTurn[] {
  // Every turn gets the same placeholder date
  return turns.map((turn) => ({ ...turn, createdAt: 'ts' }))
}

/**
 * A controllable fake of the backend: an in-memory session store, plus gates and a fail-flag that let a
 * test hold a round-trip open or fail it by hand.
 */
class FakeBackend implements DefenseConversationServices {
  /** The in-memory session store. */
  store: DefenseSession[] = []

  /** The round-trips in flight, each held open until the test releases its gate. */
  submitCalls: Array<{ request: DefenseTurnRequest; gate: PromiseWithResolvers<void> }> = []

  /** When set, the next submitTurn throws this instead of saving. */
  nextSubmitError: Error | null = null

  /** When set, deleteSession waits on this before resolving. */
  deleteGate: PromiseWithResolvers<void> | null = null

  /** When set, the next deleteSession throws this instead of dropping the session. */
  nextDeleteError: Error | null = null

  /** When true, the next rewindTurns throws instead of truncating. */
  failNextRewind = false

  /** Whether an abort rejects a held round-trip, as a real fetch does. */
  autoRejectOnAbort = true

  /** How many replies have been handed out, for distinct reply bodies. */
  private replyCount = 0

  /** How many sessions have been minted, for distinct server-side ids. */
  private sessionCount = 0

  /** @inheritdoc */
  submitTurn = async (request: DefenseTurnRequest): Promise<DefenseSession> => {
    // Register the call, held open until the test releases it
    const gate = Promise.withResolvers<void>()
    this.submitCalls.push({ request, gate })

    // Reject the wait on abort, unless the test wants it to resolve after an abort
    request.signal.addEventListener('abort', () => {
      if (this.autoRejectOnAbort) {
        gate.reject(new DOMException('Aborted', 'AbortError'))
      }
    })

    // Hold the round-trip open until the test releases the gate
    await gate.promise

    // Throw the armed error once, carrying whatever code the test set
    if (this.nextSubmitError) {
      const error = this.nextSubmitError
      this.nextSubmitError = null
      throw error
    }

    // The student's turn
    const studentTurn: Turn = { role: 'student', content: request.content }

    // A distinct examiner reply
    const replyTurn: Turn = { role: 'examiner', content: `probe ${(this.replyCount += 1)}` }

    // Both new turns, stamped as the backend would
    const newTurns = stampTurns([studentTurn, replyTurn])

    // A first turn creates the session, opening on the examiner's greeting
    if (request.kind === 'start') {
      // Assemble the new session under a server-minted id
      const session: DefenseSession = {
        id: `session-${(this.sessionCount += 1)}`,
        target: request.target,
        turns: [...stampTurns([{ role: 'examiner', content: request.opener }]), ...newTurns],
      }

      // Store it
      this.store.push(session)

      // Hand the saved session back
      return session
    }

    // Locate the open session
    const target = this.store.find((session) => session.id === request.sessionId)

    // No session carries that id
    if (!target) {
      throw new Error(`session ${request.sessionId} not found`)
    }

    // Fold the new turns into it
    const updated: DefenseSession = { ...target, turns: [...target.turns, ...newTurns] }

    // Write the session back
    this.store = this.store.map((session) => (session.id === request.sessionId ? updated : session))

    // Hand the saved session back
    return updated
  }

  /** @inheritdoc */
  deleteSession = async (sessionId: string): Promise<void> => {
    // Hold the delete open while the gate is set
    if (this.deleteGate) {
      await this.deleteGate.promise
    }

    // Throw the armed error once, carrying whatever code the test set
    if (this.nextDeleteError) {
      const error = this.nextDeleteError
      this.nextDeleteError = null
      throw error
    }

    // Drop the session from the store
    this.store = this.store.filter((session) => session.id !== sessionId)
  }

  /** @inheritdoc */
  rewindTurns = async (sessionId: string, keepThroughSequence: number): Promise<void> => {
    // Fail once when armed
    if (this.failNextRewind) {
      this.failNextRewind = false
      throw new Error('rewind failed')
    }

    // Truncate the stored session to the kept prefix
    this.store = this.store.map((session) =>
      session.id === sessionId
        ? { ...session, turns: session.turns.slice(0, keepThroughSequence + 1) }
        : session
    )
  }
}

/**
 * A model under test, its backing fake, and a read of how many history refreshes it has requested.
 */
type ModelHarness = {
  /** The model under test. */
  model: DefenseConversationModel
  /** The fake backend the model runs against. */
  backend: FakeBackend
  /** How many history refreshes the model has requested. */
  changes: () => number
}

/**
 * Builds a model over a fresh fake backend.
 *
 * @returns The model harness.
 */
function makeModel(): ModelHarness {
  // A fresh backend
  const backend = new FakeBackend()

  // How many history refreshes the model has requested
  let changes = 0

  // The model under test, wired to the fake
  const model = new DefenseConversationModel({
    problem: SAMPLE_PROBLEM,
    opener: OPENER,
    onSessionsChanged: () => {
      changes += 1
    },
  })

  // The model plus its controls
  return { model, backend, changes: () => changes }
}

/** The roles of a transcript, for terse assertions. */
function roles(turns: readonly Turn[]): string[] {
  // Just the author of each turn
  return turns.map((turn) => turn.role)
}

describe('DefenseConversationModel', () => {
  it('seeds a fresh conversation with the examiner opener', () => {
    // A brand-new model
    const { model } = makeModel()

    // Its initial state
    const state = model.getSnapshot()

    // Only the opener, idle and unsaved
    expect(state.turns).toEqual([{ role: 'examiner', content: OPENER }])
    expect(state.isThinking).toBe(false)
    expect(state.currentSessionId).toBeNull()
  })

  it('shows the student turn and the thinking indicator before the round-trip resolves', () => {
    // A fresh model
    const { model, backend } = makeModel()

    // Send a turn, leaving it unresolved
    void model.send('my answer', backend)

    // The student turn and the indicator are already on screen
    const state = model.getSnapshot()
    expect(roles(state.turns)).toEqual(['examiner', 'student'])
    expect(state.turns[1].content).toBe('my answer')
    expect(state.isThinking).toBe(true)
  })

  it('folds in the reply and opens the session when the round-trip resolves', async () => {
    // A model with a turn in flight
    const { model, backend } = makeModel()
    const sent = model.send('answer', backend)
    await flush()

    // Release the round-trip
    backend.submitCalls[0].gate.resolve()

    // The send reports the reply landed
    expect(await sent).toEqual({ kind: 'sent' })

    // The reply is shown, the indicator is gone, and the session is open and stored
    const state = model.getSnapshot()
    expect(roles(state.turns)).toEqual(['examiner', 'student', 'examiner'])
    expect(state.isThinking).toBe(false)
    expect(state.currentSessionId).not.toBeNull()
    expect(backend.store).toHaveLength(1)
  })

  it('appends to the same open session on a later turn', async () => {
    // A model with one completed turn
    const { model, backend } = makeModel()
    const first = model.send('first', backend)
    await flush()
    backend.submitCalls[0].gate.resolve()
    await first

    // The open session, noted before the second turn
    const sessionId = model.getSnapshot().currentSessionId

    // Send a second turn and let it land
    const second = model.send('second', backend)
    await flush()
    backend.submitCalls[1].gate.resolve()
    await second

    // The same session grew by the second exchange
    expect(model.getSnapshot().currentSessionId).toBe(sessionId)
    expect(backend.store).toHaveLength(1)
    expect(roles(model.getSnapshot().turns)).toEqual([
      'examiner',
      'student',
      'examiner',
      'student',
      'examiner',
    ])
  })

  it('refuses a second send while a turn is in flight and mints a single session', async () => {
    // A model with a turn in flight
    const { model, backend } = makeModel()
    const first = model.send('first', backend)

    // A second send inside that window, as a double-tap would fire, is refused
    const second = await model.send('second', backend)
    expect(second).toEqual({ kind: 'busy' })

    // No second round-trip started
    expect(backend.submitCalls).toHaveLength(1)

    // Release the first and let it land
    backend.submitCalls[0].gate.resolve()
    await first

    // Exactly one session, holding only the first student turn
    expect(backend.store).toHaveLength(1)
    expect(roles(model.getSnapshot().turns).filter((role) => role === 'student')).toEqual([
      'student',
    ])
  })

  it('stops an in-flight turn, reclaiming it and saving nothing', async () => {
    // A model with a turn in flight
    const { model, backend } = makeModel()
    const sent = model.send('answer', backend)
    await flush()
    expect(backend.submitCalls).toHaveLength(1)

    // Stop hands the draft back at once
    const reclaimed = model.stop()
    expect(reclaimed).toBe('answer')

    // The send reports it was stopped
    expect(await sent).toEqual({ kind: 'stopped' })

    // The view is back to the opener and nothing was saved
    const state = model.getSnapshot()
    expect(roles(state.turns)).toEqual(['examiner'])
    expect(state.isThinking).toBe(false)
    expect(backend.store).toHaveLength(0)
  })

  it('ignores a stop once the turn has settled', async () => {
    // A model whose turn has landed
    const { model, backend } = makeModel()
    const sent = model.send('answer', backend)
    await flush()
    backend.submitCalls[0].gate.resolve()
    await sent

    // A stop past the landing reclaims nothing
    expect(model.stop()).toBeNull()

    // The reply stands
    expect(roles(model.getSnapshot().turns)).toEqual(['examiner', 'student', 'examiner'])
  })

  it('discards a reply that resolves in the instant it is stopped', async () => {
    // A model whose round-trip resolves even after an abort
    const { model, backend } = makeModel()
    backend.autoRejectOnAbort = false
    const sent = model.send('answer', backend)
    await flush()

    // Release the round-trip and stop in the same tick, before its continuation runs
    backend.submitCalls[0].gate.resolve()
    const reclaimed = model.stop()

    // The stop wins: the turn is reclaimed and the late reply never reaches the view
    expect(reclaimed).toBe('answer')
    expect(await sent).toEqual({ kind: 'stopped' })
    const state = model.getSnapshot()
    expect(roles(state.turns)).toEqual(['examiner'])
    expect(state.currentSessionId).toBeNull()
  })

  it('treats a stopped turn as stopped even when the abandoned round-trip then fails outright', async () => {
    // A model whose backend ignores the abort rather than rejecting on it
    const { model, backend } = makeModel()
    backend.autoRejectOnAbort = false
    const sent = model.send('answer', backend)
    await flush()

    // Arm a non-abort failure
    backend.nextSubmitError = new Error('submit failed')

    // Stop the turn before it resolves
    const reclaimed = model.stop()

    // Let the abandoned round-trip run on and throw
    backend.submitCalls[0].gate.resolve()

    // The stop still wins: the draft is reclaimed and the failure never surfaces as an error
    expect(reclaimed).toBe('answer')
    expect(await sent).toEqual({ kind: 'stopped' })
    expect(roles(model.getSnapshot().turns)).toEqual(['examiner'])
  })

  it('does not clobber a fresh conversation when a session switch abandons an in-flight turn', async () => {
    // A model with a turn in flight
    const { model, backend } = makeModel()
    const sent = model.send('answer', backend)
    await flush()

    // Switch to a fresh conversation mid-flight
    model.startNew()

    // The fresh view shows just the opener, unsaved
    expect(roles(model.getSnapshot().turns)).toEqual(['examiner'])
    expect(model.getSnapshot().currentSessionId).toBeNull()

    // The abandoned round-trip resolves to stopped and never repaints the fresh view
    expect(await sent).toEqual({ kind: 'stopped' })
    expect(roles(model.getSnapshot().turns)).toEqual(['examiner'])
  })

  it('reports failed and rolls back when the round-trip errors', async () => {
    // A model whose next round-trip fails
    const { model, backend } = makeModel()
    backend.nextSubmitError = new Error('submit failed')

    // Send into the failing round-trip
    const sent = model.send('answer', backend)
    await flush()
    backend.submitCalls[0].gate.resolve()

    // The send reports the failure, with no code since the fake threw a bare error
    expect(await sent).toEqual({ kind: 'failed', errorCode: undefined })

    // The optimistic turn is rolled back and nothing was saved
    const state = model.getSnapshot()
    expect(roles(state.turns)).toEqual(['examiner'])
    expect(state.isThinking).toBe(false)
    expect(backend.store).toHaveLength(0)
  })

  it('carries the backend failure code out of a failed send', async () => {
    // A model whose next round-trip throws a coded backend error
    const { model, backend } = makeModel()
    backend.nextSubmitError = new BackendApiError({
      message: 'too many turns',
      statusCode: 422,
      errorCode: 'DefenseTurnLimit',
    })

    // Send into the coded failure
    const sent = model.send('answer', backend)
    await flush()
    backend.submitCalls[0].gate.resolve()

    // The send reports the failure carrying the backend's code
    expect(await sent).toEqual({ kind: 'failed', errorCode: 'DefenseTurnLimit' })
  })

  it('opens a stored session on resume', async () => {
    // A model with one completed session
    const { model, backend } = makeModel()
    const sent = model.send('answer', backend)
    await flush()
    backend.submitCalls[0].gate.resolve()
    await sent

    // The stored session to come back to
    const stored = backend.store[0]

    // Step away to a fresh conversation
    model.startNew()

    // Resume the stored session
    model.resume(stored)

    // Its transcript and id are shown
    const state = model.getSnapshot()
    expect(state.currentSessionId).toBe(stored.id)
    expect(state.turns).toEqual(stored.turns)
  })

  it('abandons an in-flight turn when another session is resumed', async () => {
    // A model with one completed, stored session
    const { model, backend } = makeModel()
    const first = model.send('first', backend)
    await flush()
    backend.submitCalls[0].gate.resolve()
    await first
    const firstSession = backend.store[0]

    // A second conversation with its turn in flight
    model.startNew()
    const second = model.send('second', backend)
    await flush()

    // Resume the first session mid-flight
    model.resume(firstSession)

    // The resumed session is on screen
    expect(model.getSnapshot().currentSessionId).toBe(firstSession.id)

    // The abandoned turn resolves to stopped and never repaints the resumed session
    expect(await second).toEqual({ kind: 'stopped' })
    expect(model.getSnapshot().turns).toEqual(firstSession.turns)
  })

  it('ignores a re-resume of the open session from a stale snapshot', async () => {
    // A model with one completed, open session
    const { model, backend } = makeModel()
    const sent = model.send('answer', backend)
    await flush()
    backend.submitCalls[0].gate.resolve()
    await sent

    // The live transcript and epoch, before the stale re-resume
    const live = model.getSnapshot()

    // A lagging history snapshot of the same session, missing its latest turns
    const stale: DefenseSession = {
      ...backend.store[0],
      turns: backend.store[0].turns.slice(0, 1),
    }

    // Re-resume the already-open session from that stale copy
    model.resume(stale)

    // The open view is untouched: the stale copy never truncates the live transcript or remounts it
    expect(model.getSnapshot().turns).toEqual(live.turns)
    expect(model.getSnapshot().conversationEpoch).toBe(live.conversationEpoch)
  })

  it('starts fresh when the open session is deleted', async () => {
    // A model with one completed, open session
    const { model, backend } = makeModel()
    const sent = model.send('answer', backend)
    await flush()
    backend.submitCalls[0].gate.resolve()
    await sent
    const sessionId = model.getSnapshot().currentSessionId ?? ''

    // Delete the open session
    await model.deleteSession(sessionId, backend)

    // The conversation resets and the session is gone
    const state = model.getSnapshot()
    expect(state.currentSessionId).toBeNull()
    expect(roles(state.turns)).toEqual(['examiner'])
    expect(backend.store).toHaveLength(0)
  })

  it('leaves the open conversation untouched when a different session is deleted', async () => {
    // A model with one completed session
    const { model, backend } = makeModel()
    const first = model.send('first', backend)
    await flush()
    backend.submitCalls[0].gate.resolve()
    await first
    const firstId = model.getSnapshot().currentSessionId ?? ''

    // A second completed session after a fresh start
    model.startNew()
    const second = model.send('second', backend)
    await flush()
    backend.submitCalls[1].gate.resolve()
    await second
    const secondId = model.getSnapshot().currentSessionId ?? ''

    // Delete the older, non-open session
    await model.deleteSession(firstId, backend)

    // The open conversation stays, only the deleted session leaves the store
    expect(model.getSnapshot().currentSessionId).toBe(secondId)
    expect(backend.store.map((session) => session.id)).toEqual([secondId])
  })

  it('keeps the open conversation on screen when deleting it fails', async () => {
    // A model with one completed, open session
    const { model, backend } = makeModel()
    const sent = model.send('answer', backend)
    await flush()
    backend.submitCalls[0].gate.resolve()
    await sent
    const sessionId = model.getSnapshot().currentSessionId ?? ''

    // Arm a delete failure
    backend.nextDeleteError = new Error('delete failed')

    // Delete the open session into the failure
    const outcome = await model.deleteSession(sessionId, backend)

    // The delete reports failure and the open transcript is left exactly as it was
    expect(outcome).toEqual({ kind: 'failed', errorCode: undefined })
    expect(model.getSnapshot().currentSessionId).toBe(sessionId)
    expect(roles(model.getSnapshot().turns)).toEqual(['examiner', 'student', 'examiner'])
  })

  it('treats deleting an already-gone session as a successful delete', async () => {
    // A model with one completed, open session
    const { model, backend } = makeModel()
    const sent = model.send('answer', backend)
    await flush()
    backend.submitCalls[0].gate.resolve()
    await sent
    const sessionId = model.getSnapshot().currentSessionId ?? ''

    // Arm a not-found failure, as the backend raises for a session deleted elsewhere
    backend.nextDeleteError = new BackendApiError({
      message: 'gone',
      statusCode: 404,
      errorCode: 'DefenseSessionNotFound',
    })

    // Delete the open session
    const outcome = await model.deleteSession(sessionId, backend)

    // The end state matches intent, so it resolves as done and drops back to a fresh conversation
    expect(outcome).toEqual({ kind: 'done' })
    expect(model.getSnapshot().currentSessionId).toBeNull()
    expect(roles(model.getSnapshot().turns)).toEqual(['examiner'])
  })

  it('rewinds the open conversation to the kept prefix', async () => {
    // A model grown to two exchanges: examiner, student, examiner, student, examiner
    const { model, backend } = makeModel()
    const first = model.send('first', backend)
    await flush()
    backend.submitCalls[0].gate.resolve()
    await first
    const second = model.send('second', backend)
    await flush()
    backend.submitCalls[1].gate.resolve()
    await second
    const sessionId = model.getSnapshot().currentSessionId ?? ''

    // Rewind to the first examiner reply, dropping the second exchange
    const outcome = await model.rewind(2, backend)

    // The rewind reports it landed and the view keeps only the 0..2 prefix
    expect(outcome).toEqual({ kind: 'done' })
    expect(roles(model.getSnapshot().turns)).toEqual(['examiner', 'student', 'examiner'])

    // The stored session was truncated to match
    const stored = backend.store.find((session) => session.id === sessionId)
    expect(roles(stored?.turns ?? [])).toEqual(['examiner', 'student', 'examiner'])
  })

  it('reports failed and leaves the transcript untouched when the rewind errors', async () => {
    // A completed, open session
    const { model, backend } = makeModel()
    const sent = model.send('answer', backend)
    await flush()
    backend.submitCalls[0].gate.resolve()
    await sent

    // Arm a rewind failure
    backend.failNextRewind = true

    // Attempt the rewind
    const outcome = await model.rewind(0, backend)

    // The failure is reported and the full transcript stands
    expect(outcome).toEqual({ kind: 'failed', errorCode: undefined })
    expect(roles(model.getSnapshot().turns)).toEqual(['examiner', 'student', 'examiner'])
  })

  it('abandons an in-flight turn when the conversation is rewound', async () => {
    // A model with one completed exchange and a second turn left in flight
    const { model, backend } = makeModel()
    const first = model.send('first', backend)
    await flush()
    backend.submitCalls[0].gate.resolve()
    await first
    const second = model.send('second', backend)
    await flush()
    expect(model.getSnapshot().isThinking).toBe(true)

    // Rewind mid-flight to the first examiner reply
    const outcome = await model.rewind(2, backend)

    // The rewind lands, the abandoned turn resolves to stopped, and the idle view is the kept prefix
    expect(outcome).toEqual({ kind: 'done' })
    expect(await second).toEqual({ kind: 'stopped' })
    const state = model.getSnapshot()
    expect(roles(state.turns)).toEqual(['examiner', 'student', 'examiner'])
    expect(state.isThinking).toBe(false)
  })

  it('reports failed without a round-trip on an unsaved conversation', async () => {
    // A fresh, unsaved model
    const { model, backend } = makeModel()

    // A rewind has no saved conversation to truncate
    const outcome = await model.rewind(0, backend)

    // It fails up front, leaving the opener-only view in place
    expect(outcome).toEqual({ kind: 'failed', errorCode: undefined })
    expect(roles(model.getSnapshot().turns)).toEqual(['examiner'])
  })

  it('requests a history refresh after a turn lands, a rewind, and a delete', async () => {
    // A model with a completed, open session
    const { model, backend, changes } = makeModel()
    const sent = model.send('answer', backend)
    await flush()
    backend.submitCalls[0].gate.resolve()
    await sent

    // The landed turn asked the history to refresh once
    expect(changes()).toBe(1)

    // Rewind to the examiner opener, dropping the rest
    await model.rewind(0, backend)

    // The rewind asked the history to refresh again, so a resume can't restore the dropped turns
    expect(changes()).toBe(2)

    // Delete the open session
    const sessionId = model.getSnapshot().currentSessionId ?? ''
    await model.deleteSession(sessionId, backend)

    // The delete asked the history to refresh a third time
    expect(changes()).toBe(3)
  })

  it('bumps the conversation epoch on a switch but not within a conversation', async () => {
    // A model and its starting epoch
    const { model, backend } = makeModel()
    const start = model.getSnapshot().conversationEpoch

    // A send stays within the same conversation
    const sent = model.send('answer', backend)
    await flush()
    backend.submitCalls[0].gate.resolve()
    await sent
    expect(model.getSnapshot().conversationEpoch).toBe(start)

    // Starting fresh switches conversation
    model.startNew()
    expect(model.getSnapshot().conversationEpoch).toBe(start + 1)
  })

  it('notifies subscribers on change and stops after unsubscribe', () => {
    // A model with a change counter subscribed
    const { model } = makeModel()
    let notifications = 0
    const unsubscribe = model.subscribe(() => {
      notifications += 1
    })

    // Change state
    model.startNew()

    // The listener fired
    expect(notifications).toBeGreaterThan(0)

    // Note the count before detaching
    const seen = notifications

    // Detach the listener
    unsubscribe()

    // Another state change
    model.startNew()

    // The detached listener stayed silent
    expect(notifications).toBe(seen)
  })
})
