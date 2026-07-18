import type {
  DefenseProblem,
  DefenseSession,
  DefenseTurnRequest,
  Turn,
  TurnRole,
} from './defense-types'

/**
 * The outcome of sending a student turn: `sent` when the examiner replied, `failed` when the round-trip
 * errored, `stopped` when the student aborted it, `busy` when a turn was already in flight.
 */
export type SendOutcome = 'sent' | 'failed' | 'stopped' | 'busy'

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
  /** A conversation counter, distinct across conversations and stable within one. */
  readonly conversationEpoch: number
}

/**
 * The backend calls the model drives. Injected, so the state machine can run against a controllable
 * fake.
 */
export type DefenseConversationServices = {
  /** Advances the conversation by one turn: saves the student's turn and answers it in one round-trip. */
  submitTurn: (request: DefenseTurnRequest) => Promise<DefenseSession>
  /** Deletes a session. */
  deleteSession: (sessionId: string) => Promise<void>
}

/**
 * Everything the model needs to run one problem's defense conversation.
 */
export type DefenseConversationModelOptions = {
  /** The problem being defended. */
  problem: DefenseProblem
  /** The examiner's opening line. */
  opener: string
  /** The backend calls to drive. */
  services: DefenseConversationServices
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
  /** The student turn's markdown/math source, reclaimed on a stop. */
  content: string
  /** The transcript before the student's turn, restored on a stop or failure. */
  priorTurns: readonly Turn[]
}

/**
 * Builds a turn for immediate display. Carries no timestamp: the backend assigns one on save, and the
 * transcript reconciles to the stored turns once the round-trip resolves.
 *
 * @param role - The turn's author.
 * @param content - The turn's markdown/math source.
 *
 * @returns The turn.
 */
function draftTurn(role: TurnRole, content: string): Turn {
  // A turn shown before persistence
  return { role, content }
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
 * backend calls are injected, so the concurrency around an in-flight turn is unit-testable against a
 * controllable fake.
 */
export class DefenseConversationModel {
  /** The problem being defended. */
  private readonly problem: DefenseProblem

  /** The examiner's opening line. */
  private readonly opener: string

  /** The backend calls. */
  private readonly services: DefenseConversationServices

  /** Called after any write to the session store. */
  private readonly onSessionsChanged: () => void

  /** The current state, replaced wholesale on every change. */
  private state: DefenseConversationState

  /** The turn currently in flight, or null while none is. */
  private currentRun: InFlight | null = null

  /** The state-change listeners. */
  private readonly listeners = new Set<() => void>()

  /**
   * Builds the model over its injected services, seeded with a fresh, unsaved conversation.
   *
   * @param options - The problem, opener, services, and history callback the model runs on.
   */
  constructor(options: DefenseConversationModelOptions) {
    // Keep the injected problem, opener, and calls
    this.problem = options.problem
    this.opener = options.opener
    this.services = options.services
    this.onSessionsChanged = options.onSessionsChanged

    // Seed a fresh conversation with the examiner's opener
    this.state = {
      turns: [draftTurn('examiner', options.opener)],
      isThinking: false,
      currentSessionId: null,
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
   *
   * @returns How the turn resolved.
   */
  send = async (content: string): Promise<SendOutcome> => {
    // Deterministic guard against a double-tap: a second send that outruns the composer's Send/Stop
    // swap is refused here, so the double-tap lands a single turn
    if (this.currentRun !== null) {
      return 'busy'
    }

    // Snapshot the transcript so a stop or failure can roll back to it
    const priorTurns = this.state.turns

    // The open session, or null to mint a fresh one on this turn
    const sessionId = this.state.currentSessionId

    // Claim the run synchronously, before the first await, so a second send this tick sees it
    const run: InFlight = { controller: new AbortController(), content, priorTurns }
    this.currentRun = run

    // Show the student's turn and the examiner at work immediately
    this.setState({ turns: [...priorTurns, draftTurn('student', content)], isThinking: true })

    // Open a new session under a freshly minted id, or append to the session already open
    const request: DefenseTurnRequest =
      sessionId === null
        ? {
            kind: 'start',
            id: crypto.randomUUID(),
            problemKey: this.problem.key,
            opener: this.opener,
            content,
            signal: run.controller.signal,
          }
        : { kind: 'continue', sessionId, content, signal: run.controller.signal }

    try {
      // One round-trip: save the turn and get back the updated session
      const session = await this.services.submitTurn(request)

      // A stop or switch superseded this run during the wait: drop the reply it no longer owns
      if (run.controller.signal.aborted || !this.ownsView(run)) {
        return 'stopped'
      }

      // Swap in the server-dated transcript, open the session, and drop the indicator
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
      return 'sent'
    } catch {
      // A stop or switch aborted this run, or it no longer owns the view: stay silent, its rollback
      // was handled by whoever took over
      if (run.controller.signal.aborted || !this.ownsView(run)) {
        return 'stopped'
      }

      // A real failure on the still-open conversation: drop the optimistic turn and the indicator
      this.setState({ turns: priorTurns, isThinking: false })

      // The run is over
      this.currentRun = null

      // The round-trip failed
      return 'failed'
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

    // Drop the optimistic student turn and the indicator, and reopen the gate
    this.setState({ turns: inFlight.priorTurns, isThinking: false })
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

    // Reseed a blank conversation with just the examiner's opener
    this.setState({
      currentSessionId: null,
      turns: [draftTurn('examiner', this.opener)],
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

    // Show the chosen session's stored transcript
    this.setState({
      currentSessionId: session.id,
      turns: session.turns,
      conversationEpoch: this.state.conversationEpoch + 1,
    })
  }

  /**
   * Deletes a session, dropping back to a fresh conversation when it was the open one.
   *
   * @param sessionId - The id of the session to delete.
   */
  deleteSession = async (sessionId: string): Promise<void> => {
    // Deleting the open session leaves nothing to show, so drop to a fresh conversation up front: this
    // cancels its in-flight turn, and doing it before the await keeps a session switch during the
    // delete from being clobbered by a stale re-check afterwards
    if (sessionId === this.state.currentSessionId) {
      this.startNew()
    }

    // Remove it from the store
    await this.services.deleteSession(sessionId)

    // The history changed
    this.onSessionsChanged()
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

    // Drop its record and the indicator so a trailing reply is ignored
    this.currentRun = null
    this.setState({ isThinking: false })
  }
}
