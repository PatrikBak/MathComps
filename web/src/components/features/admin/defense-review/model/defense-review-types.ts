import type {
  DefenseFeedback,
  DefenseReportCategory,
  DefenseTurnReport,
  StoredTurn,
} from '@/components/features/defense/model/defense-types'
import type { ProblemSource } from '@/components/features/problems/types/problem-api-types'

/**
 * Somebody the review names: the student who held a conversation, or the reviewer who wrote a note about
 * one. The username can be missing, so the address rides alongside it; a deleted account has neither.
 */
export type DefenseReviewUser = {
  /** Stable identifier. */
  id: string
  /** The name the site calls them by; null while they have chosen none, and once their account is deleted. */
  username: string | null
  /** Their address; null once their account is deleted. */
  email: string | null
}

/**
 * A handout problem a conversation was held against, which the reader's own side names from handout content
 * it already holds.
 */
export type DefenseReviewHandoutTarget = {
  /** Which arm this is. */
  kind: 'handout'
  /** The handout's permanent content id. */
  handoutContentId: string
  /** The environment's permanent id, unique within its handout. */
  environmentId: string
}

/**
 * An archive problem a conversation was held against, already named: nothing on the reader's side can name a
 * competition still under embargo.
 */
export type DefenseReviewProblemTarget = {
  /** Which arm this is. */
  kind: 'problem'
  /** URL-safe identifier, unique across the archive. */
  slug: string
  /** Where the problem comes from. */
  source: ProblemSource
}

/**
 * What a conversation was held against. Exactly one arm applies to any one conversation.
 */
export type DefenseReviewTarget = DefenseReviewHandoutTarget | DefenseReviewProblemTarget

/**
 * One conversation as the review queue lists it: who held it, what it was against, how it opened, and every mark
 * that decides whether it is worth opening.
 */
export type DefenseReviewConversation = {
  /** Stable identifier. */
  id: string
  /** The problem it was held against. */
  target: DefenseReviewTarget
  /** Who held it. */
  user: DefenseReviewUser
  /** The start of the student's most recent message; null when it holds no student turn. */
  lastStudentMessage: string | null
  /** How many turns it holds in total. */
  turnCount: number
  /** When something was last said in it, as an ISO-8601 string. */
  lastActivityAt: string
  /** When it was last read, as an ISO-8601 string; null while it never has been. */
  readAt: string | null
  /** How many of its turns arrived after it was last read; every turn when it never has been. */
  unreadTurnCount: number
  /** How many notes have been written about it. */
  noteCount: number
  /** Whether the student reported any of its replies. */
  hasStudentReport: boolean
  /** Whether the student said where it left them. */
  hasStudentFeedback: boolean
}

/**
 * Which conversations the queue shows. Every field is optional, and leaving one out means the filter is not
 * applied rather than applied looking for the absent case.
 */
export type DefenseReviewFilter = {
  /** True for conversations with unread turns, absent for both. */
  unread?: boolean
  /** True for conversations carrying notes, false for those carrying none, absent for both. */
  hasNotes?: boolean
  /** True for conversations where the student reported a reply, absent for both. */
  studentReported?: boolean
  /** True for conversations the student answered for, absent for both. */
  studentFeedback?: boolean
  /** Whose conversations to show. */
  userId?: string
  /** Which handout's conversations to show. */
  handoutContentId?: string
  /** Which problem within that handout, only meaningful alongside the handout. */
  environmentId?: string
  /** Which archive problem's conversations to show, which one slug addresses on its own. */
  problemSlug?: string
  /** How recently the conversation must have moved, in days. */
  withinDays?: number
  /** Which examiner settings the conversation ran on. */
  promptVersion?: string
}

/**
 * One student the queue can be filtered to.
 */
export type DefenseReviewUserOption = {
  /** The student. */
  user: DefenseReviewUser
  /** How many conversations they have held. */
  conversationCount: number
}

/**
 * One problem the queue can be filtered to.
 */
export type DefenseReviewProblemOption = {
  /** The problem. */
  target: DefenseReviewTarget
  /** How many conversations have been held against it. */
  conversationCount: number
}

/**
 * One set of examiner settings the queue can be filtered to, standing in for "conversations run on this prompt".
 */
export type DefenseReviewPromptVersionOption = {
  /** The settings' version key. */
  version: string
  /** When a conversation first ran on these settings, as an ISO-8601 string. */
  firstSeenAt: string
  /** When one last did, as an ISO-8601 string. */
  lastSeenAt: string
  /** How many have run on them. */
  conversationCount: number
}

/**
 * What the queue's filters can be set to.
 */
export type DefenseReviewFilterOptions = {
  /** Everyone who has held a conversation. */
  users: DefenseReviewUserOption[]
  /** Every problem one has been held against. */
  problems: DefenseReviewProblemOption[]
  /** Every set of examiner settings one has run on. */
  promptVersions: DefenseReviewPromptVersionOption[]
}

/**
 * One note written while reviewing a conversation.
 */
export type AdminNote = {
  /** Stable identifier. */
  id: string
  /** The conversation it is about. */
  sessionId: string
  /** The reply it is against; null when it is against the conversation as a whole. */
  turnId: string | null
  /** The reviewer who wrote it. */
  author: DefenseReviewUser
  /** Whether the reviewer reading it wrote it, which is what decides whether it can be revised or dropped. */
  isOwn: boolean
  /** The note as markdown/math source. */
  content: string
  /** Which failure it names; null when it names none. */
  category: DefenseReportCategory | null
  /** When it was settled, as an ISO-8601 string; null while it still stands. */
  resolvedAt: string | null
  /** When it was written, as an ISO-8601 string. */
  createdAt: string
  /** When it last changed, as an ISO-8601 string. */
  updatedAt: string
}

/**
 * One conversation in full, for reading back: everything the student saw, everything the examiner was given, the
 * settings it ran on, and what has already been written about it.
 */
export type DefenseReviewDetail = {
  /** Stable identifier. */
  id: string
  /** The problem it was held against. */
  target: DefenseReviewTarget
  /** Who held it. */
  user: DefenseReviewUser
  /** The problem statement as it stood when it was started. */
  statement: string
  /** The reference solution the examiner held, the author's hints already folded into it. */
  reference: string
  /** The examiner settings it ran on, as recorded; an empty object for one held before they were recorded. */
  examinerConfig: ExaminerConfigSnapshot
  /** The conversation in order. */
  turns: StoredTurn[]
  /** Every reply the examiner drafted on its way to each turn; turns held before the drafts were kept carry none. */
  attempts: DefenseTurnAttempt[]
  /** What the student holds against individual replies. */
  reports: DefenseTurnReport[]
  /** What the student said about the whole conversation; null when they said nothing. */
  feedback: DefenseFeedback | null
  /** What has been written about it while reviewing, newest first. */
  notes: AdminNote[]
  /** When it was last read, as it stood before this read; null while it never has been. */
  readAt: string | null
  /** When it was started, as an ISO-8601 string. */
  createdAt: string
}

/**
 * The examiner's steps, in the order they run.
 */
export const EXAMINER_STEPS = ['generate', 'mathCheck', 'leakCheck', 'languageCheck'] as const

/**
 * One step of the examiner's turn: the call that writes the reply, or one of the guards that judges it. Each routes
 * to its own model and reasoning level, so this is the axis a turn's cost breaks down along.
 */
export type ExaminerStep = (typeof EXAMINER_STEPS)[number]

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
 * attempt of a turn is the reply the student read; the rest are drafts a guard sent back, so they carry exactly the
 * leaks and wrong claims the loop exists to keep from the student.
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
  /** What the student had assembled, when the close was withheld; empty otherwise. */
  established: string
  /** Whether the reply drifted out of the student's language. */
  switchesLanguage: boolean
  /** The language the student's latest turn was written in. */
  candidateLanguage: string
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

/**
 * One step of the examiner's recorded settings. Every field is optional because the snapshot is stored as it was
 * written and never read into a shape by the backend, so an older one may be missing anything.
 */
export type ExaminerStepSnapshot = {
  /** Path to the step's prompt template. */
  promptPath?: string
  /** The prompt template's raw text, uninterpolated, as read when this was recorded. */
  promptText?: string
  /** The model the step was configured to run on. */
  model?: string
  /** The backup models the step was configured to fall back through, in order. */
  fallbackModels?: string[]
  /** The reasoning-effort level the step ran at. */
  reasoningEffort?: string
  /** The cap on the step's output tokens. */
  maxOutputTokens?: number
}

/**
 * The examiner's recorded settings for one conversation. Empty for one held before settings were recorded at all.
 */
export type ExaminerConfigSnapshot = {
  /** The step that produces the reply. */
  generate?: ExaminerStepSnapshot
  /** The step that checks the reply's mathematics. */
  mathCheck?: ExaminerStepSnapshot
  /** The step that checks the reply gives nothing away. */
  leakCheck?: ExaminerStepSnapshot
  /** The step that checks the reply is in the student's language. */
  languageCheck?: ExaminerStepSnapshot
  /** How many times a flagged reply may be regenerated. */
  maxRevisions?: number
}

/**
 * One note in the cross-conversation feed, carrying enough of where it was written to be read on its own.
 */
export type AdminNoteFeedItem = {
  /** The note. */
  note: AdminNote
  /** The problem its conversation was held against. */
  target: DefenseReviewTarget
  /** Who held that conversation. */
  user: DefenseReviewUser
  /** Where the reply it is against sits; null when it is against the conversation as a whole. */
  turnSequence: number | null
}

/**
 * Names somebody on a review surface, since either half of what identifies them can be missing.
 *
 * @param user - The person to name.
 * @param unnamedLabel - What to call somebody the site holds neither a name nor an address for.
 *
 * @returns Their username, their address when they have chosen no name, and the label when neither is left.
 */
export function describeReviewUser(user: DefenseReviewUser, unnamedLabel: string): string {
  // Whichever half the site still holds, and the label when it holds neither
  return user.username ?? user.email ?? unnamedLabel
}
