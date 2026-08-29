import { errorCodeOf } from '@/lib/api/api-error'
import type { AppErrorCode } from '@/lib/api/api-error-codes'

import type {
  DefenseFeedback,
  DefenseProblem,
  DefenseSession,
  DefenseTurnReport,
  DefenseTurnRequest,
  StoredTurn,
  Turn,
  TurnRole,
} from './defense-types'

/**
 * A sent student turn: the examiner replied and the transcript advanced.
 */
type TurnSent = {
  /** The discriminator. */
  kind: 'sent'
}

/**
 * A stopped student turn: the student aborted the round-trip, or a session switch superseded it.
 */
type TurnStopped = {
  /** The discriminator. */
  kind: 'stopped'
}

/**
 * A refused student turn: a turn was already in flight, so the double-tap landed nothing new.
 */
type TurnBusy = {
  /** The discriminator. */
  kind: 'busy'
}

/**
 * A failed student turn: the round-trip errored on the still-open conversation.
 */
type TurnFailed = {
  /** The discriminator. */
  kind: 'failed'
  /** The backend's failure code, or undefined when the failure carried none. */
  errorCode: AppErrorCode | undefined
}

/**
 * The outcome of sending a student turn.
 */
export type SendOutcome = TurnSent | TurnStopped | TurnBusy | TurnFailed

/**
 * A completed rewind: the conversation was truncated to the kept prefix.
 */
type RewindDone = {
  /** The discriminator. */
  kind: 'done'
}

/**
 * A failed rewind: the round-trip errored, leaving the conversation untouched.
 */
type RewindFailed = {
  /** The discriminator. */
  kind: 'failed'
  /** The backend's failure code, or undefined when the failure carried none. */
  errorCode: AppErrorCode | undefined
}

/**
 * The outcome of a rewind.
 */
export type RewindOutcome = RewindDone | RewindFailed

/**
 * A completed delete: the session was removed from the store.
 */
type DeleteDone = {
  /** The discriminator. */
  kind: 'done'
}

/**
 * A failed delete: the round-trip errored, so the session remains.
 */
type DeleteFailed = {
  /** The discriminator. */
  kind: 'failed'
  /** The backend's failure code, or undefined when the failure carried none. */
  errorCode: AppErrorCode | undefined
}

/**
 * The outcome of deleting a session.
 */
export type DeleteOutcome = DeleteDone | DeleteFailed

/**
 * The observable state of a defense conversation.
 */
export type DefenseConversationState = {
  /** The live transcript, oldest first. */
  readonly turns: readonly Turn[]
  /** Whether the examiner is working on the next reply. */
  readonly isThinking: boolean
  /** The id of the open session, or null while a fresh one is unsaved. */
  readonly currentSessionId: string | null
  /** What the student said the open conversation came to, or null until they say. */
  readonly currentFeedback: DefenseFeedback | null
  /** What the student holds against the open conversation's replies, by reply. */
  readonly reports: ReadonlyMap<string, DefenseTurnReport>
  /** A conversation counter, distinct across conversations and stable within one. */
  readonly conversationEpoch: number
}

/**
 * The backend calls the model drives, passed to each action.
 */
export type DefenseConversationServices = {
  /** Advances the conversation by one turn: saves the student's turn and answers it in one round-trip. */
  submitTurn: (request: DefenseTurnRequest) => Promise<DefenseSession>
  /** Deletes a session. */
  deleteSession: (sessionId: string) => Promise<void>
  /** Drops every turn after the kept one from the session. */
  rewindTurns: (sessionId: string, keepThroughSequence: number) => Promise<void>
}

/**
 * Everything the model needs to run one problem's defense conversation.
 */
export type DefenseConversationModelOptions = {
  /** The problem being defended. */
  problem: DefenseProblem
  /** Called after any write to the session store. */
  onSessionsChanged: () => void
}

/**
 * The turn currently in flight: what it takes to reclaim the student's turn if they stop it, and the
 * controller that aborts the round-trip.
 */
type InFlight = {
  /** Aborts the round-trip. */
  controller: AbortController
  /** The student turn's markdown/math source. */
  content: string
  /** The transcript before the student's turn. */
  priorTurns: readonly Turn[]
}

/**
 * Builds a turn for immediate display. Carries neither identity nor timestamp: the backend assigns both on
 * save, and the transcript reconciles to the stored turns once the round-trip resolves.
 *
 * @param role - The turn's author.
 * @param content - The turn's markdown/math source.
 *
 * @returns The turn.
 */
export function draftTurn(role: TurnRole, content: string): Turn {
  // The unsaved draft turn
  return { id: null, createdAt: null, role, content }
}

/**
 * Indexes a conversation's reports by the reply each one is against.
 *
 * @param reports - The reports to index.
 *
 * @returns The reports under their replies.
 */
export function indexReports(
  reports: readonly DefenseTurnReport[]
): ReadonlyMap<string, DefenseTurnReport> {
  // Each report under the reply it holds something against
  return new Map(reports.map((report) => [report.turnId, report]))
}

/**
 * Finds the first turn to have arrived after a given moment, which is where a reader coming back to the
 * conversation picks up.
 *
 * The moment itself belongs to what was already there, so a turn authored on it is not one of the new ones.
 *
 * @param turns - The conversation in order, oldest first.
 * @param momentIso - The moment to measure against, as an ISO-8601 string; null when nothing marks one.
 *
 * @returns The first turn after that moment, or null when none of them is.
 */
export function findFirstTurnAfter(
  turns: readonly StoredTurn[],
  momentIso: string | null
): StoredTurn | null {
  // Nothing to measure against, so nothing counts as having arrived since
  if (momentIso === null) {
    return null
  }

  // That moment as a timestamp
  const moment = new Date(momentIso).getTime()

  // The first turn authored past it
  return turns.find((turn) => new Date(turn.createdAt).getTime() > moment) ?? null
}

/**
 * Where a reader's pass through a conversation stops, and how much of it is left to read.
 */
export type ReadPassBoundary = {
  /** When the pass stopped, as an ISO-8601 string; null when nothing counts as read. */
  readAt: string | null
  /**
   * The first turn left to read; null only in a conversation with no turns at all. Named rather than derived
   * from the moment above, which has nothing to name when the pass stops short of every turn.
   */
  firstNewTurnId: string | null
  /** How many turns arrived after it. */
  unreadTurnCount: number
}

/**
 * Works out where a pass through a conversation would stop for a given turn to be the first one left to read.
 *
 * The stop is a moment rather than a place in the conversation, so it lands on the last turn recorded before that
 * one. Two turns recorded in the same moment can't be told apart by one, so a turn sharing its moment with the one
 * before it takes that one with it.
 *
 * @param turns - As in {@link findFirstTurnAfter}.
 * @param turnId - The turn to be left as the first one unread.
 *
 * @returns Where the pass stops, and what stands past it.
 */
export function findReadPassBefore(turns: readonly StoredTurn[], turnId: string): ReadPassBoundary {
  // When the turn to pick up from was recorded
  const pickUpAt = turns.find((turn) => turn.id === turnId)?.createdAt

  // A turn the conversation doesn't hold leaves the pass where a conversation nobody has read has it
  if (pickUpAt === undefined) {
    return { readAt: null, firstNewTurnId: turns[0]?.id ?? null, unreadTurnCount: turns.length }
  }

  // That moment as a timestamp
  const pickUpMoment = new Date(pickUpAt).getTime()

  // Everything recorded before it, which is as far as the pass reaches
  const read = turns.filter((turn) => new Date(turn.createdAt).getTime() < pickUpMoment)

  // Where it stops, which is the last of them; nothing precedes the turn when there are none
  return {
    readAt: read.at(-1)?.createdAt ?? null,
    firstNewTurnId: turns[read.length]?.id ?? null,
    unreadTurnCount: turns.length - read.length,
  }
}

/**
 * The state machine behind one problem's defense conversation: the live transcript, sending a student
 * turn and folding in the examiner's reply, and the stop / session-switch flows around an in-flight
 * turn.
 *
 * A turn is one atomic round-trip: the backend saves the student's turn and answers it together, so it
 * either lands whole (turn saved, reply shown) or fails whole (nothing saved, draft handed back).
 *
 * Framework-agnostic and observable: {@link subscribe} to changes and read {@link getSnapshot}. Its
 * backend calls are passed to each action, so the concurrency around an in-flight turn is unit-testable
 * against a controllable fake.
 */
export class DefenseConversationModel {
  /** The problem being defended. */
  private readonly problem: DefenseProblem

  /** Called after any write to the session store. */
  private readonly onSessionsChanged: () => void

  /** The current state, replaced wholesale on every change. */
  private state: DefenseConversationState

  /** The turn currently in flight, or null while none is. */
  private currentRun: InFlight | null = null

  /** The state-change listeners. */
  private readonly listeners = new Set<() => void>()

  /**
   * Builds the model, seeded with a fresh, unsaved conversation.
   *
   * @param options - The problem and history callback the model runs on.
   */
  constructor(options: DefenseConversationModelOptions) {
    // Keep the injected problem and history callback
    this.problem = options.problem
    this.onSessionsChanged = options.onSessionsChanged

    // Seed a conversation the student has yet to say anything into
    this.state = {
      turns: [],
      isThinking: false,
      currentSessionId: null,
      currentFeedback: null,
      reports: new Map(),
      conversationEpoch: 0,
    }
  }

  /**
   * Subscribes to state changes.
   *
   * @param listener - Called on every state change.
   *
   * @returns A function that removes the listener.
   */
  subscribe = (listener: () => void): (() => void) => {
    // Register the listener
    this.listeners.add(listener)

    // Hand back its remover
    return () => {
      this.listeners.delete(listener)
    }
  }

  /**
   * Reads the current state.
   *
   * @returns The current state, a stable reference until the next change.
   */
  getSnapshot = (): DefenseConversationState => {
    // The current state
    return this.state
  }

  /**
   * Sends a student turn and folds in the examiner's reply.
   *
   * @param content - The student turn's markdown/math source.
   * @param services - The backend call to send the turn.
   *
   * @returns How the turn resolved.
   */
  send = async (
    content: string,
    services: Pick<DefenseConversationServices, 'submitTurn'>
  ): Promise<SendOutcome> => {
    // Deterministic guard against a double-tap: a second send before the first settles is refused, so
    // the double-tap lands a single turn
    if (this.currentRun !== null) {
      return { kind: 'busy' }
    }

    // Snapshot the transcript so a stop or failure can roll back to it
    const priorTurns = this.state.turns

    // The open session, or null to mint a fresh one on this turn
    const sessionId = this.state.currentSessionId

    // Claim the run synchronously, before the first await, so a second send this tick sees it
    const run: InFlight = { controller: new AbortController(), content, priorTurns }
    this.currentRun = run

    // Show the student's turn and the examiner at work immediately
    this.setState({ turns: [...priorTurns, draftTurn('candidate', content)], isThinking: true })

    // Open a new session (the backend mints its id), or append to the session already open
    const request: DefenseTurnRequest =
      sessionId === null
        ? { kind: 'start', target: this.problem.target, content, signal: run.controller.signal }
        : { kind: 'continue', sessionId, content, signal: run.controller.signal }

    try {
      // One round-trip: save the turn and get back the updated session
      const session = await services.submitTurn(request)

      // A stop or switch superseded this run during the wait: drop the reply it no longer owns
      if (run.controller.signal.aborted || !this.ownsView(run)) {
        return { kind: 'stopped' }
      }

      // Swap in the server-dated transcript, open the session, and drop the indicator. What the student has
      // said about the conversation is left alone: the reply carries the session as the backend read it when
      // the turn began, so anything they said while it ran would be rolled back by folding it in.
      this.setState({
        turns: session.turns,
        currentSessionId: session.id,
        isThinking: false,
      })

      // The run has settled
      this.currentRun = null

      // The history changed
      this.onSessionsChanged()

      // The reply landed
      return { kind: 'sent' }
    } catch (error) {
      // A stop or switch aborted this run, or it no longer owns the view: stay silent, its rollback
      // was handled by whoever took over
      if (run.controller.signal.aborted || !this.ownsView(run)) {
        return { kind: 'stopped' }
      }

      // A real failure on the still-open conversation: drop the optimistic turn and the indicator
      this.setState({ turns: priorTurns, isThinking: false })

      // The run is over
      this.currentRun = null

      // The round-trip failed, carrying why it failed
      return { kind: 'failed', errorCode: errorCodeOf(error) }
    }
  }

  /**
   * Stops the in-flight turn and reclaims the student's message.
   *
   * @returns The reclaimed student turn's source, or null when nothing is in flight.
   */
  stop = (): string | null => {
    // Nothing is running
    const inFlight = this.currentRun
    if (inFlight === null) {
      return null
    }

    // Abort the in-flight round-trip
    inFlight.controller.abort()

    // Drop the optimistic student turn and the indicator
    this.setState({ turns: inFlight.priorTurns, isThinking: false })

    // Reopen the gate for the next send
    this.currentRun = null

    // Hand the reclaimed text back to the caller
    return inFlight.content
  }

  /**
   * Starts a fresh, unsaved conversation.
   */
  startNew = (): void => {
    // Cancel any turn still in flight for the conversation being left
    this.abandonInFlight()

    // Reseed a blank conversation
    this.setState({
      currentSessionId: null,
      currentFeedback: null,
      reports: new Map(),
      turns: [],
      conversationEpoch: this.state.conversationEpoch + 1,
    })
  }

  /**
   * Opens an existing session's transcript.
   *
   * @param session - The session to open.
   */
  resume = (session: DefenseSession): void => {
    // The open conversation is already this session's live truth
    if (session.id === this.state.currentSessionId) {
      return
    }

    // Cancel any turn still in flight for the conversation being left
    this.abandonInFlight()

    // Show the chosen session's stored transcript, whatever the student said it came to, and whatever they
    // hold against its replies, so a reopened conversation reads exactly as they left it
    this.setState({
      currentSessionId: session.id,
      currentFeedback: session.feedback,
      reports: indexReports(session.reports),
      turns: session.turns,
      conversationEpoch: this.state.conversationEpoch + 1,
    })
  }

  /**
   * Records what the student says a conversation came to.
   *
   * @param sessionId - The session the answer was given for.
   * @param feedback - The answer they gave, or null once they have taken it back.
   */
  setFeedback = (sessionId: string, feedback: DefenseFeedback | null): void => {
    // The answer belongs to a conversation that is no longer on screen, so showing it here would
    // report one conversation's answer against another
    if (sessionId !== this.state.currentSessionId) {
      return
    }

    // Hold it as what the conversation came to
    this.setState({ currentFeedback: feedback })
  }

  /**
   * Records what the student holds against one of a conversation's replies, once the backend has taken it.
   *
   * @param sessionId - The session the reported reply was given in.
   * @param report - What they hold against it.
   */
  setReport = (sessionId: string, report: DefenseTurnReport): void => {
    // The report belongs to a conversation that is no longer on screen, so showing it here would mark a
    // reply the student never said anything about
    if (sessionId !== this.state.currentSessionId) {
      return
    }

    // Hold it against the reply, replacing anything said about that reply before
    this.setState({ reports: new Map(this.state.reports).set(report.turnId, report) })
  }

  /**
   * Stops holding anything against one of a conversation's replies.
   *
   * @param sessionId - The session the reply was given in.
   * @param turnId - The reply to stop holding anything against.
   */
  clearReport = (sessionId: string, turnId: string): void => {
    // The withdrawal belongs to a conversation that is no longer on screen, so acting on it here would
    // clear a mark against some other conversation's reply
    if (sessionId !== this.state.currentSessionId) {
      return
    }

    // The reply carries nothing again
    const remaining = new Map(this.state.reports)
    remaining.delete(turnId)

    // Show it unmarked
    this.setState({ reports: remaining })
  }

  /**
   * Deletes a session, dropping back to a fresh conversation when it was the open one.
   *
   * @param sessionId - The id of the session to delete.
   * @param services - The backend call to remove the session.
   *
   * @returns How the delete resolved.
   */
  deleteSession = async (
    sessionId: string,
    services: Pick<DefenseConversationServices, 'deleteSession'>
  ): Promise<DeleteOutcome> => {
    // Refresh the history either way: a failed delete leaves the session in place, so re-fetching
    // restores it to the list rather than leaving a phantom removal on screen
    try {
      // Remove it from the store; a missing session is already gone, so a not-found is a successful
      // delete, not a failure
      try {
        await services.deleteSession(sessionId)
      } catch (error) {
        // The code the delete failed with
        const errorCode = errorCodeOf(error)

        // Only a real failure reports back; a missing session falls through as already-deleted
        if (errorCode !== 'DefenseSessionNotFound') {
          return { kind: 'failed', errorCode }
        }
      }

      // The session is gone: drop to a fresh conversation when it was the open one (this also cancels
      // any in-flight turn). Re-checking currentSessionId guards a session switch during the delete.
      if (sessionId === this.state.currentSessionId) {
        this.startNew()
      }

      // The session was removed
      return { kind: 'done' }
    } finally {
      // Re-sync the history either way: a failed delete restores the session, a success drops it
      this.onSessionsChanged()
    }
  }

  /**
   * Rewinds the open conversation to a chosen point, dropping every turn after it. The server truncates
   * first; only on success is the local transcript cut to the kept prefix. Draft handling is the
   * caller's, not the model's.
   *
   * @param keepThroughSequence - The sequence of the last turn to keep; every later turn is dropped.
   *   The transcript is the contiguous 0..N turns the server stores, so a turn's sequence is its index.
   * @param services - The backend call to truncate the session.
   *
   * @returns How the rewind resolved.
   */
  rewind = async (
    keepThroughSequence: number,
    services: Pick<DefenseConversationServices, 'rewindTurns'>
  ): Promise<RewindOutcome> => {
    // Only a saved conversation has turns on the server to drop
    const sessionId = this.state.currentSessionId
    if (sessionId === null) {
      return { kind: 'failed', errorCode: undefined }
    }

    try {
      // Truncate the persisted conversation before touching the view
      await services.rewindTurns(sessionId, keepThroughSequence)
    } catch (error) {
      // The server still holds the full conversation, so leave the transcript as it was
      return { kind: 'failed', errorCode: errorCodeOf(error) }
    }

    // Drop any turn still in flight so a trailing reply can't repaint the shortened transcript
    this.abandonInFlight()

    // Show only the kept prefix. What the student held against the dropped replies goes with them, and the
    // entries left behind here are unreachable, since no reply the conversation grows back is one of those
    this.setState({ turns: this.state.turns.slice(0, keepThroughSequence + 1) })

    // The stored session was truncated, so refresh the history to match
    this.onSessionsChanged()

    // The conversation was rewound
    return { kind: 'done' }
  }

  /**
   * Replaces the state with the given changes folded in and notifies listeners.
   *
   * @param changes - The state fields to change.
   */
  private setState(changes: Partial<DefenseConversationState>): void {
    // Fold the changes into a fresh object so subscribers see a new reference
    this.state = { ...this.state, ...changes }

    // Notify every listener
    this.listeners.forEach((listener) => listener())
  }

  /**
   * Whether a run still owns the view: it is the one in flight, so its writes may paint the state.
   *
   * @param run - The run to check.
   *
   * @returns Whether the run is the one in flight.
   */
  private ownsView(run: InFlight): boolean {
    // Ownership is being the claimed run
    return this.currentRun === run
  }

  /**
   * Cancels any in-flight turn and drops its record, so a reply for the conversation being left behind
   * can neither repaint the new view nor surface a failure on it.
   */
  private abandonInFlight(): void {
    // Stop any in-flight round-trip
    this.currentRun?.controller.abort()

    // Drop its record so a trailing reply is ignored
    this.currentRun = null

    // Clear the thinking indicator
    this.setState({ isThinking: false })
  }
}
