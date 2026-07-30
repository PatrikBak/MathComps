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

  /** How many turns have been stored, for distinct server-minted turn ids. */
  private turnCount = 0

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
    const studentTurn: Turn = { id: null, role: 'candidate', content: request.content }

    // A distinct examiner reply
    const replyTurn: Turn = {
      id: null,
      role: 'examiner',
      content: `probe ${(this.replyCount += 1)}`,
    }

    // Both new turns, stamped as the backend would
    const newTurns = this.stampTurns([studentTurn, replyTurn])

    // A first turn creates the session, opening on the examiner's greeting
    if (request.kind === 'start') {
      // Assemble the new session under a server-minted id
      const session: DefenseSession = {
        id: `session-${(this.sessionCount += 1)}`,
        target: request.target,
        turns: [
          ...this.stampTurns([{ id: null, role: 'examiner', content: request.opener }]),
          ...newTurns,
        ],
        feedback: null,
        reports: [],
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

  /**
   * Stamps turns with an identity and a fixed timestamp, standing in for what the backend assigns
   * on save.
   *
   * @param turns - The turns to stamp.
   *
   * @returns The stored turns.
   */
  private stampTurns(turns: Turn[]): StoredTurn[] {
    // Every turn gets its own id and the same placeholder date
    return turns.map((turn) => ({ ...turn, id: `turn-${(this.turnCount += 1)}`, createdAt: 'ts' }))
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
    expect(state.turns).toEqual([{ id: null, role: 'examiner', content: OPENER }])
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
    expect(roles(state.turns)).toEqual(['examiner', 'candidate'])
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
    expect(roles(state.turns)).toEqual(['examiner', 'candidate', 'examiner'])
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
      'candidate',
      'examiner',
      'candidate',
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
    expect(roles(model.getSnapshot().turns).filter((role) => role === 'candidate')).toEqual([
      'candidate',
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
    expect(roles(model.getSnapshot().turns)).toEqual(['examiner', 'candidate', 'examiner'])
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
    const sessionId = backend.store[0].id

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
    const firstId = backend.store[0].id

    // A second completed session after a fresh start
    model.startNew()
    const second = model.send('second', backend)
    await flush()
    backend.submitCalls[1].gate.resolve()
    await second
    const secondId = backend.store[1].id

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
    const sessionId = backend.store[0].id

    // Arm a delete failure
    backend.nextDeleteError = new Error('delete failed')

    // Delete the open session into the failure
    const outcome = await model.deleteSession(sessionId, backend)

    // The delete reports failure and the open transcript is left exactly as it was
    expect(outcome).toEqual({ kind: 'failed', errorCode: undefined })
    expect(model.getSnapshot().currentSessionId).toBe(sessionId)
    expect(roles(model.getSnapshot().turns)).toEqual(['examiner', 'candidate', 'examiner'])
  })

  it('treats deleting an already-gone session as a successful delete', async () => {
    // A model with one completed, open session
    const { model, backend } = makeModel()
    const sent = model.send('answer', backend)
    await flush()
    backend.submitCalls[0].gate.resolve()
    await sent
    const sessionId = backend.store[0].id

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
    // A model grown to two exchanges: examiner, candidate, examiner, candidate, examiner
    const { model, backend } = makeModel()
    const first = model.send('first', backend)
    await flush()
    backend.submitCalls[0].gate.resolve()
    await first
    const second = model.send('second', backend)
    await flush()
    backend.submitCalls[1].gate.resolve()
    await second

    // Rewind to the first examiner reply, dropping the second exchange
    const outcome = await model.rewind(2, backend)

    // The rewind reports it landed and the view keeps only the 0..2 prefix
    expect(outcome).toEqual({ kind: 'done' })
    expect(roles(model.getSnapshot().turns)).toEqual(['examiner', 'candidate', 'examiner'])

    // The stored session was truncated to match
    expect(roles(backend.store[0].turns)).toEqual(['examiner', 'candidate', 'examiner'])
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
    expect(roles(model.getSnapshot().turns)).toEqual(['examiner', 'candidate', 'examiner'])
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
    expect(roles(state.turns)).toEqual(['examiner', 'candidate', 'examiner'])
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

  it('shows a resumed conversation answer and asks again on a fresh one', async () => {
    // A model with one completed, stored session
    const { model, backend } = makeModel()
    const sent = model.send('answer', backend)
    await flush()
    backend.submitCalls[0].gate.resolve()
    await sent

    // That session as the history hands it back once the student has summed it up
    const answered: DefenseSession = {
      ...backend.store[0],
      feedback: { outcome: 'foundTheMistake', comment: null },
    }

    // Step away, so reopening it is a real switch rather than a no-op re-resume
    model.startNew()

    // Reopen it
    model.resume(answered)

    // Its answer comes with it, so the conversation stops asking
    expect(model.getSnapshot().currentFeedback).toEqual({
      outcome: 'foundTheMistake',
      comment: null,
    })

    // Step away to a fresh conversation
    model.startNew()

    // Which carries no answer of its own, so it asks
    expect(model.getSnapshot().currentFeedback).toBeNull()
  })

  it('ignores an answer that lands after the conversation has moved on', async () => {
    // A model with one completed, open session
    const { model, backend } = makeModel()
    const sent = model.send('answer', backend)
    await flush()
    backend.submitCalls[0].gate.resolve()
    await sent
    const answeredSessionId = backend.store[0].id

    // Step away before the answer's round-trip lands
    model.startNew()

    // The answer lands, naming the session it was given for
    model.setFeedback(answeredSessionId, { outcome: 'confirmedTheSolution', comment: null })

    // The conversation on screen is a different one, so it is left asking
    expect(model.getSnapshot().currentFeedback).toBeNull()
  })

  it('ignores a report that lands after the conversation has moved on', async () => {
    // A model with one completed, open session
    const { model, backend } = makeModel()
    const sent = model.send('answer', backend)
    await flush()
    backend.submitCalls[0].gate.resolve()
    await sent
    const reportedSessionId = backend.store[0].id
    const reportedTurnId = backend.store[0].turns[2].id

    // Step away before the report's round-trip lands
    model.startNew()

    // The report lands, naming the session its reply was given in
    model.setReport(reportedSessionId, {
      turnId: reportedTurnId,
      categories: ['saidSomethingWrong'],
      comment: null,
    })

    // The conversation on screen holds none of that conversation's replies, so nothing is marked
    expect(model.getSnapshot().reports.size).toBe(0)
  })

  it('keeps a conversation answered through the turns that follow it', async () => {
    // A model with one completed, open session
    const { model, backend } = makeModel()
    const first = model.send('first', backend)
    await flush()
    backend.submitCalls[0].gate.resolve()
    await first
    const sessionId = backend.store[0].id

    // Answer for the conversation
    model.setFeedback(sessionId, { outcome: 'notEnoughHelp', comment: null })

    // Carry on with it: the reply this turn brings back was composed before the answer landed, so
    // folding its view of the conversation in would undo it
    const second = model.send('second', backend)
    await flush()
    backend.submitCalls[1].gate.resolve()
    await second

    // The conversation still says what the student said it came to
    expect(model.getSnapshot().currentFeedback?.outcome).toBe('notEnoughHelp')
  })

  it('keeps a reply reported through the turns that follow it', async () => {
    // A model with one completed, open session
    const { model, backend } = makeModel()
    const first = model.send('first', backend)
    await flush()
    backend.submitCalls[0].gate.resolve()
    await first
    const sessionId = backend.store[0].id
    const replyId = backend.store[0].turns[2].id

    // Report the reply
    model.setReport(sessionId, {
      turnId: replyId,
      categories: ['saidSomethingWrong'],
      comment: 'which case?',
    })

    // Carry on with the conversation: the reply this turn brings back was composed before the report
    // landed, so folding its view of the conversation in would undo it
    const second = model.send('second', backend)
    await flush()
    backend.submitCalls[1].gate.resolve()
    await second

    // The reply is still reported
    expect(model.getSnapshot().reports.get(replyId)?.categories).toEqual(['saidSomethingWrong'])
  })

  it('keeps a surviving reply reported through a rewind', async () => {
    // A model grown to two exchanges: examiner, candidate, examiner, candidate, examiner
    const { model, backend } = makeModel()
    const first = model.send('first', backend)
    await flush()
    backend.submitCalls[0].gate.resolve()
    await first
    const second = model.send('second', backend)
    await flush()
    backend.submitCalls[1].gate.resolve()
    await second
    const sessionId = backend.store[0].id
    const keptReplyId = backend.store[0].turns[2].id

    // Report the first of the examiner's replies
    model.setReport(sessionId, { turnId: keptReplyId, categories: ['gaveAway'], comment: null })

    // Rewind to it, dropping the second exchange
    await model.rewind(2, backend)

    // The reply survived the cut, so what the student holds against it survives with it
    expect(model.getSnapshot().reports.get(keptReplyId)?.categories).toEqual(['gaveAway'])
  })

  it('reopens a conversation already showing what was reported in it', async () => {
    // A model with one completed session, whose reply the student reported in an earlier sitting
    const { model, backend } = makeModel()
    const sent = model.send('answer', backend)
    await flush()
    backend.submitCalls[0].gate.resolve()
    await sent
    const stored = backend.store[0]
    const replyId = stored.turns[2].id
    stored.reports = [
      { turnId: replyId, categories: ['misunderstood'], comment: 'the bound is wrong' },
    ]

    // Step away
    model.startNew()

    // Come back to it
    model.resume(stored)

    // The reply is marked again, carrying what was said about it
    expect(model.getSnapshot().reports.get(replyId)?.categories).toEqual(['misunderstood'])
  })

  it('keeps every reported reply marked as another one is reported', async () => {
    // A model grown to two exchanges, so it holds two of the examiner's replies
    const { model, backend } = makeModel()
    const first = model.send('first', backend)
    await flush()
    backend.submitCalls[0].gate.resolve()
    await first
    const second = model.send('second', backend)
    await flush()
    backend.submitCalls[1].gate.resolve()
    await second
    const sessionId = backend.store[0].id
    const firstReplyId = backend.store[0].turns[2].id
    const secondReplyId = backend.store[0].turns[4].id

    // Report the first of the replies
    model.setReport(sessionId, { turnId: firstReplyId, categories: ['gaveAway'], comment: null })

    // Then the second
    model.setReport(sessionId, { turnId: secondReplyId, categories: ['tone'], comment: null })

    // Each reply carries its own, so reporting one didn't take the other with it
    const { reports } = model.getSnapshot()
    expect(reports.get(firstReplyId)?.categories).toEqual(['gaveAway'])
    expect(reports.get(secondReplyId)?.categories).toEqual(['tone'])
  })

  it('replaces what is held against a reply when the student revises it', async () => {
    // A model with one completed, open session whose reply is already reported
    const { model, backend } = makeModel()
    const sent = model.send('answer', backend)
    await flush()
    backend.submitCalls[0].gate.resolve()
    await sent
    const sessionId = backend.store[0].id
    const replyId = backend.store[0].turns[2].id
    model.setReport(sessionId, { turnId: replyId, categories: ['gaveAway'], comment: null })

    // Revise what is held against it
    model.setReport(sessionId, { turnId: replyId, categories: ['tone'], comment: 'she was rude' })

    // The reply carries the revision, and carries it in place of the first complaint rather than
    // beside it
    const { reports } = model.getSnapshot()
    expect(reports.size).toBe(1)
    expect(reports.get(replyId)).toEqual({
      turnId: replyId,
      categories: ['tone'],
      comment: 'she was rude',
    })
  })

  it('stops holding anything against a reply once it is taken back', async () => {
    // A model with one completed, open session whose reply is reported
    const { model, backend } = makeModel()
    const sent = model.send('answer', backend)
    await flush()
    backend.submitCalls[0].gate.resolve()
    await sent
    const sessionId = backend.store[0].id
    const replyId = backend.store[0].turns[2].id
    model.setReport(sessionId, { turnId: replyId, categories: ['tone'], comment: null })
    const before = model.getSnapshot().reports

    // Take it back
    model.clearReport(sessionId, replyId)

    // The reply carries nothing again
    expect(model.getSnapshot().reports.has(replyId)).toBe(false)

    // Under a map of its own, since subscribers are handed the state itself and compare it by
    // identity
    expect(model.getSnapshot().reports).not.toBe(before)
  })

  it('leaves what was said about one conversation behind when another is resumed', async () => {
    // A model with two completed, stored conversations
    const { model, backend } = makeModel()
    const first = model.send('first', backend)
    await flush()
    backend.submitCalls[0].gate.resolve()
    await first
    model.startNew()
    const second = model.send('second', backend)
    await flush()
    backend.submitCalls[1].gate.resolve()
    await second

    // The first one as the history hands it back, summed up and with a reported reply
    const answered: DefenseSession = {
      ...backend.store[0],
      feedback: { outcome: 'wasOff', comment: null },
      reports: [{ turnId: backend.store[0].turns[2].id, categories: ['tone'], comment: null }],
    }

    // Reopen it
    model.resume(answered)

    // Then move on to the one the student never said anything about
    model.resume(backend.store[1])

    // Which is left asking, with none of the first conversation's replies marked
    const state = model.getSnapshot()
    expect(state.currentFeedback).toBeNull()
    expect(state.reports.size).toBe(0)
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
    await model.deleteSession(backend.store[0].id, backend)

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
