import type { HandoutEnvironmentTarget } from '@/components/features/handouts/handout-metadata-types'
import type { ProblemSource } from '@/components/features/problems/types/problem-api-types'

import type { DefenseTarget } from './defense-target'

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
  /** When the message was authored, as an ISO-8601 string; null while it is a draft. */
  createdAt: string | null
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
 * The handout environment a defense is held against: the same two ids whether a request names it or a
 * listing reads it back.
 */
export type NamedHandoutTarget = {
  /** The discriminant. */
  kind: 'handout'
} & HandoutEnvironmentTarget

/**
 * A stored defense held against one archive problem, as the API names it.
 */
type ProblemSessionTarget = {
  /** The discriminant. */
  kind: 'problem'
  /** The problem being defended. */
  problemId: string
}

/**
 * What a stored defense says it is about, in the shape the API returns it: a handout's environment, or an
 * archive problem. Flatter than the {@link DefenseTarget} the surface works in, which also carries what a
 * competition area needs to key its own caches by.
 */
export type DefenseSessionTarget = NamedHandoutTarget | ProblemSessionTarget

/**
 * One defense conversation a student has held about a single problem: the full transcript plus its
 * identity. A student may hold several about the same problem over time.
 */
export type DefenseSession = {
  /** Stable identifier. */
  id: string
  /** What this defense is about, as the API says it. */
  target: DefenseSessionTarget
  /** The conversation so far, oldest first. */
  turns: StoredTurn[]
  /** What the student said about the conversation; null until they say anything. */
  feedback: DefenseFeedback | null
  /** What the student holds against the conversation's replies, one entry per reported reply. */
  reports: DefenseTurnReport[]
}

/**
 * The caps a defense is held to: what a student may type, and how far a conversation may go. They are the
 * backend's own configuration, so they can change without a deploy.
 */
export type DefenseLimits = {
  /** The longest a single student message may be, in characters. */
  maxCandidateChars: number
  /** The longest a feedback comment may be, in characters. */
  maxFeedbackCommentChars: number
  /** The most student turns one conversation may hold. */
  maxTurnsPerSession: number
}

/**
 * What a problem's defense surface opens on: the conversations held against it, and the caps a further one
 * is held to.
 */
export type DefenseSessionList = {
  /** The conversations, most recently active first. */
  sessions: DefenseSession[]
  /** The caps they are held to. */
  limits: DefenseLimits
}

/**
 * An archive problem a conversation was held against, named as well as addressed: nothing on the reader's
 * side can name a competition still under embargo.
 */
export type NamedProblemTarget = {
  /** The discriminant. */
  kind: 'problem'
  /** The problem being defended. */
  problemId: string
  /** The competition it was set in, identified by the round it runs as. */
  competitionId: string
  /** URL-safe identifier, unique across the archive. */
  slug: string
  /** Where the problem comes from. */
  source: ProblemSource
}

/**
 * What a conversation was held against, as a surface reading conversations back names it. Exactly one arm
 * applies to any one conversation.
 */
export type NamedDefenseTarget = NamedHandoutTarget | NamedProblemTarget

/**
 * One of a user's defenses as it appears in their cross-problem list: a summary of what it was about, when it
 * last moved, and where the student got to. It carries no turns.
 */
export type DefenseSessionListItem = {
  /** Stable identifier. */
  id: string
  /** What this defense is about. */
  target: NamedDefenseTarget
  /** The problem statement as it stood when the session was started. */
  statement: string
  /** When something was last said in the conversation, as an ISO-8601 string. */
  lastActivityAt: string
  /** The student's most recent message; null when the session has none. */
  lastStudentMessage: string | null
}

/**
 * Open on the most recently active conversation held against the problem, if there is one.
 */
type OpenNewestDefense = {
  /** The discriminant. */
  kind: 'newest'
}

/**
 * Open on one named conversation.
 */
type OpenNamedDefense = {
  /** The discriminant. */
  kind: 'named'
  /** Which conversation to open. */
  sessionId: string
}

/**
 * Open on a blank conversation, leaving whatever is already saved where it is.
 */
type OpenFreshDefense = {
  /** The discriminant. */
  kind: 'fresh'
}

/**
 * Which conversation the chat opens on.
 *
 * Its own member for a blank one rather than an absent id: a surface that starts second conversations needs
 * to say "not the newest, a new one", which no id and no absence of one can spell.
 */
export type DefenseOpening = OpenNewestDefense | OpenNamedDefense | OpenFreshDefense

/**
 * The problem a defense is held against. The reasoning it is measured against never reaches the client:
 * the backend resolves the statement, reference and hints from the target itself, and the statement here
 * is only the copy the chat shows alongside the conversation.
 */
export type DefenseProblem = {
  /** What this problem is: a handout's environment, or a competition's problem. */
  target: DefenseTarget
  /** The problem statement as markdown/math source. */
  statement: string
}

/**
 * A request to open a brand-new defense session with the student's first turn: the backend mints the
 * session (its id comes back on the response), seeds it with the examiner's greeting, saves the turn,
 * and answers it in one round-trip. Only the target rides along — the backend looks the problem itself
 * up from it.
 */
type StartDefenseTurnRequest = {
  /** Marks the request that opens a new session. */
  kind: 'start'
  /** What the new session is about. */
  target: DefenseTarget
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

/**
 * Frontend mirror of AiConsentDto from the backend: where the student stands on acknowledging that
 * Mathilda is not a person and that conversations with her are stored and read.
 */
export type MathildaConsent = {
  /** When they acknowledged it, as an ISO-8601 string; null while they have yet to. */
  consentedAt: string | null
}

/**
 * Where the reader stands on the {@link MathildaConsent}, as far as the frontend can tell. The last member
 * is the read itself having failed, which leaves neither answer in hand and so is not a refusal.
 */
export type MathildaConsentStatus = 'loading' | 'given' | 'missing' | 'unknown'
