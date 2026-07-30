import type { HandoutEnvironmentTarget } from '@/components/features/handouts/handout-metadata-types'

/**
 * Who authored a turn in a defense conversation: the AI examiner probing the solution, or the student
 * defending it.
 */
export type TurnRole = 'examiner' | 'candidate'

/**
 * A single message in a defense conversation: who authored it and its body.
 */
export type Turn = {
  /** Stable identifier; null while the message is a draft the backend hasn't taken yet. */
  id: string | null
  /** Who authored the message. */
  role: TurnRole
  /** The message body as markdown/math source. */
  content: string
}

/**
 * A {@link Turn} the backend has persisted: identified for good, and stamped with its authored time.
 */
export type StoredTurn = Turn & {
  /** Stable identifier. */
  id: string
  /** When the message was authored, as an ISO-8601 string. */
  createdAt: string
}

/**
 * How one examiner reply went wrong, in the student's judgement. Each member names a different thing to go and
 * fix, so a report says which way she went wrong rather than merely that she did. The last one says nothing on
 * its own and so comes with the student's own account.
 */
export type DefenseReportCategory =
  | 'misunderstood'
  | 'saidSomethingWrong'
  | 'gaveAway'
  | 'missedTheMistake'
  | 'tone'
  | 'other'

/**
 * What the examiner did for the student over a whole conversation. An outcome rather than a rating: a defense
 * that ends unpleasantly can be the one that worked. Every member sits on the one axis of what she did, and the
 * last one closes the axis off so every conversation has a place to land. It says nothing on its own and so
 * comes with the student's own account.
 */
export type DefenseOutcome =
  | 'foundTheMistake'
  | 'confirmedTheSolution'
  | 'notEnoughHelp'
  | 'wasOff'
  | 'somethingElse'

/**
 * What a student said about a whole defense conversation.
 */
export type DefenseFeedback = {
  /** What the examiner did for them. */
  outcome: DefenseOutcome
  /** What they said in their own words; null when they let the outcome stand alone. */
  comment: string | null
}

/**
 * What a student holds against one examiner reply.
 */
export type DefenseTurnReport = {
  /** The reported reply's id. */
  turnId: string
  /** Every way the reply went wrong. */
  categories: DefenseReportCategory[]
  /** The student's own account of what went wrong; null when they gave none. */
  comment: string | null
}

/**
 * One defense conversation a student has held about a single problem: the full transcript plus its
 * identity. A student may hold several about the same problem over time.
 */
export type DefenseSession = {
  /** Stable identifier. */
  id: string
  /** The handout environment this defense is about. */
  target: HandoutEnvironmentTarget
  /** The conversation so far, oldest first. */
  turns: StoredTurn[]
  /** What the student said about the conversation; null until they say anything. */
  feedback: DefenseFeedback | null
  /** What the student holds against the conversation's replies, one entry per reported reply. */
  reports: DefenseTurnReport[]
}

/**
 * One of a user's defenses as it appears in their cross-problem list: a summary of what it was about and how it
 * opened. It carries no turns.
 */
export type DefenseSessionListItem = {
  /** Stable identifier. */
  id: string
  /** The handout environment this defense is about. */
  target: HandoutEnvironmentTarget
  /** The problem statement as it stood when the session was started. */
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
  /** The handout environment this problem is. */
  target: HandoutEnvironmentTarget
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
  /** The handout environment the new session is about. */
  target: HandoutEnvironmentTarget
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
