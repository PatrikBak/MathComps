/**
 * Who authored a turn in a defense conversation: the AI examiner probing the solution, or the student
 * defending it.
 */
export type TurnRole = 'examiner' | 'student'

/**
 * A single message in a defense conversation: who authored it and its body.
 */
export type Turn = {
  /** Who authored the message. */
  role: TurnRole
  /** The message body as markdown/math source. */
  content: string
}

/**
 * A {@link Turn} the backend has persisted, stamped with its authored time.
 */
export type StoredTurn = Turn & {
  /** When the message was authored, as an ISO-8601 string. */
  createdAt: string
}

/**
 * One defense conversation a student has held about a single problem: the full transcript plus its
 * identity. A student may hold several about the same problem over time.
 */
export type DefenseSession = {
  /** Stable identifier. */
  id: string
  /** The problem this defense is about (the problem's stable key). */
  problemKey: string
  /** The conversation so far, oldest first. */
  turns: StoredTurn[]
}

/**
 * One of a user's defenses as it appears in their cross-problem list: a summary of what it was about and how it
 * opened. It carries no turns.
 */
export type DefenseSessionListItem = {
  /** Stable identifier. */
  id: string
  /** The problem this defense is about (the problem's stable key). */
  problemKey: string
  /** The problem statement, seen by both sides. */
  statement: string
  /** When the session was started, as an ISO-8601 string. */
  createdAt: string
  /** The student's first message; null when the session has none. */
  firstStudentMessage: string | null
}

/**
 * The problem a defense is held against, including the reference solution the examiner reasons from.
 */
export type DefenseProblem = {
  /** The problem's stable key. */
  key: string
  /** The problem statement as markdown/math source. */
  statement: string
  /** The reference solution the examiner reasons from, as markdown/math source. */
  reference: string
  /** The author's step-by-step hints, each as markdown/math source; empty when the problem has none. */
  hints: string[]
}

/**
 * A request to open a brand-new defense session with the student's first turn: the backend mints the
 * session (its id comes back on the response), seeds it with the examiner's greeting, saves the turn,
 * and answers it in one round-trip. The problem and its reference ride along so the examiner can reason.
 */
type StartDefenseTurnRequest = {
  /** Marks the request that opens a new session. */
  kind: 'start'
  /** The problem's stable key the new session is about. */
  problemKey: string
  /** The problem statement, seen by both sides. */
  statement: string
  /** The reference solution the examiner reasons from. */
  reference: string
  /** The author's step-by-step hints, each as markdown/math source; empty when the problem has none. */
  hints: string[]
  /** The examiner's opening line, saved as the new session's first turn. */
  opener: string
  /** The student's turn as markdown/math source. */
  content: string
  /** Aborts the in-flight round-trip when the student stops the turn. */
  signal: AbortSignal
}

/**
 * A request to advance an open defense session by one turn: the backend saves the student's turn,
 * answers it, and returns the grown session in one round-trip.
 */
type ContinueDefenseTurnRequest = {
  /** Marks a request against an existing session. */
  kind: 'continue'
  /** The open session's id. */
  sessionId: string
  /** The student's turn as markdown/math source. */
  content: string
  /** Aborts the in-flight round-trip when the student stops the turn. */
  signal: AbortSignal
}

/**
 * A request to advance a defense conversation by one turn: {@link StartDefenseTurnRequest} to open a
 * new session, or {@link ContinueDefenseTurnRequest} to grow an open one.
 */
export type DefenseTurnRequest = StartDefenseTurnRequest | ContinueDefenseTurnRequest
