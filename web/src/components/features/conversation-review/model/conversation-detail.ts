import type { Grade, SelfAssessment } from '@/components/features/admin/grades/model/grade-types'
import type {
  DefenseFeedback,
  DefenseTurnReport,
  NamedDefenseTarget,
  StoredTurn,
} from '@/components/features/defense/model/defense-types'
import type { UserIdentity } from '@/components/features/profile/model/user-identity'
import type { QueryUiState } from '@/lib/query-ui-state'

import type { ExaminerConfigSnapshot, ExaminerStep } from './examiner-config'
import type { ReviewNote } from './note-types'

/**
 * One of the conversations somebody held about a problem.
 */
type AuthorConversation = {
  /** Stable identifier. */
  id: string
  /** When it was started, as an ISO-8601 string. */
  createdAt: string
}

/**
 * One conversation as a reviewer reads it back: everything its author saw, everything the examiner was given, the
 * settings it ran on, the drafts behind each reply, what the author made of it, and what has already been written
 * about it.
 */
export type ConversationDetail = AuthorConversation & {
  /** The problem it was held against. */
  target: NamedDefenseTarget
  /** Who held it. */
  user: UserIdentity
  /** The problem statement as it stood when it was started. */
  statement: string
  /** The reference solution the examiner held, the problem author's hints already folded into it. */
  reference: string
  /** The conversation in order. */
  turns: StoredTurn[]
  /** Every reply the examiner drafted on its way to each turn; turns held before the drafts were kept carry none. */
  attempts: DefenseTurnAttempt[]
  /** What its author holds against individual replies. */
  reports: DefenseTurnReport[]
  /** What its author said about the whole conversation; null when they said nothing. */
  feedback: DefenseFeedback | null
  /** The examiner settings it ran on, as recorded; an empty object for one held before they were recorded. */
  examinerConfig: ExaminerConfigSnapshot
  /** What has been written about it by its reviewers, newest first. */
  notes: ReviewNote[]
  /** When it was last read, as it stood before this read; null while it never has been. */
  readAt: string | null
}

/**
 * Where a student's graded entry stands on one problem.
 */
export type StudentGrading = {
  /** The conversations the entry's window holds, which are the ones the grade is read from. */
  countingConversationIds: string[]
  /**
   * When the entry stopped counting: its clock running out, or the student handing it in ahead of that. What they
   * said after it counts toward nothing, even inside a conversation the grade is read from.
   */
  endedAt: string
  /** The grade; null while nobody has given one. */
  grade: Grade | null
  /** What the student said about their own solution; null when they said nothing. */
  selfAssessment: SelfAssessment | null
}

/**
 * Every conversation one author held about one problem, and where their grade on it stands.
 */
export type AuthorConversations = {
  /** The conversations, oldest first. */
  conversations: AuthorConversation[]
  /** Where the grade stands; null unless the author is a student whose entry on the problem is graded. */
  grading: StudentGrading | null
}

/**
 * One author's conversations about one problem, as far as reading them has got.
 */
export type AuthorConversationsResult = {
  /** The conversations and their grading; null until they have been read. */
  authorConversations: AuthorConversations | null
  /** The state of the read. */
  uiState: QueryUiState
}

/**
 * One model call an attempt made, what it billed and how long it took.
 */
export type DefenseAttemptCall = {
  /** The step that made the call. */
  step: ExaminerStep
  /** The model it routed to. */
  model: string
  /** The reasoning-effort level it ran at; null when none was sent. */
  reasoningEffort: string | null
  /** The call's billed cost in credits. */
  cost: number
  /** The call's prompt tokens. */
  promptTokens: number
  /** The call's completion tokens, the reasoning ones counted among them. */
  completionTokens: number
  /** The reasoning portion of the completion tokens. */
  reasoningTokens: number
  /** How long the call took, in milliseconds; 0 on one made before the timings were kept. */
  durationMs: number
}

/**
 * One reply the examiner drafted on its way to a turn, every guard's verdict on it, and what it cost. Only the last
 * attempt of a turn is the reply the conversation's author read; the rest are drafts a guard sent back, so they
 * carry exactly what the loop exists to keep from that author.
 */
export type DefenseTurnAttempt = {
  /** The turn it was drafted for. */
  turnId: string
  /** Its place in the turn's run, 0-based. */
  attemptIndex: number
  /** The drafted reply. */
  reply: string
  /** The flaw the generator was told to fix; empty on the first attempt. */
  revisionNote: string
  /** Whether every claim the reply asserts held. */
  mathHolds: boolean
  /** Which claim was wrong and the correct statement; empty when they all held. */
  mathCorrection: string
  /** Whether the reply handed over unearned progress. */
  leaks: boolean
  /** The step or idea given away; empty when nothing was. */
  whatLeaked: string
  /** Whether the reply pressed on although the solution was already complete. */
  withholdsClose: boolean
  /** What the conversation's author had assembled, when the close was withheld; empty otherwise. */
  established: string
  /** Whether the reply drifted out of the conversation author's language. */
  switchesLanguage: boolean
  /** The language the conversation author's latest turn was written in. */
  candidateLanguage: string
  /** Whether a word in the reply took the conversation's author for a man or a woman. */
  gendersTheReader: boolean
  /** Whether the reply left the conversation author's argument to walk them through the examiner's own. */
  takesOver: boolean
  /** The conversation author's own work; empty when they had brought nothing. */
  candidateWork: string
  /** The reference sentence the reply's question fished for; empty when its answer is nowhere in the reference. */
  restatedReferenceStep: string
  /** Whether this attempt is the constrained fallback the revision cap fell back to. */
  isSafeFallback: boolean
  /** The model calls this attempt made. */
  calls: DefenseAttemptCall[]
  /**
   * How long the attempt took end to end, in milliseconds; 0 on one made before the timings were kept. The guards
   * judge concurrently, so this is shorter than its calls add up to.
   */
  durationMs: number
}
