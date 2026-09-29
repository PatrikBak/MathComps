import type { UserIdentity } from '@/components/features/admin/model/user-identity'
import type { NamedDefenseTarget } from '@/components/features/defense/model/defense-types'

/**
 * One conversation as the review queue lists it: who held it, what it was against, how it opened, and every mark
 * that decides whether it is worth opening.
 */
export type DefenseReviewConversation = {
  /** Stable identifier. */
  id: string
  /** The problem it was held against. */
  target: NamedDefenseTarget
  /** Who held it. */
  user: UserIdentity
  /** The start of the student's most recent message; null when they have sent none. */
  lastStudentMessage: string | null
  /** How many messages the student has sent in it. */
  studentMessageCount: number
  /** When something was last said in it, as an ISO-8601 string. */
  lastActivityAt: string
  /** When it was last read, as an ISO-8601 string; null while it never has been. */
  readAt: string | null
  /**
   * Whether anything at all has arrived in it since it was last read, the examiner's replies included. Separate
   * from {@link DefenseReviewConversation.unreadStudentMessageCount}, which counts only what the student said: a
   * conversation picked up again from one of the examiner's replies stands unread with none of theirs left in it.
   */
  isUnread: boolean
  /** How many of those messages arrived after it was last read; every one of them when it never has been. */
  unreadStudentMessageCount: number
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
  /**
   * Which flaws a guard must have caught in the conversation. Every one listed must have been caught, each in any of
   * the conversation's drafts, the ones sent back to be rewritten included.
   */
  caughtFlaws?: ExaminerFlaw[]
}

/**
 * One student the queue can be filtered to.
 */
export type DefenseReviewStudentOption = {
  /** The student. */
  user: UserIdentity
  /** How many conversations they have held. */
  conversationCount: number
}

/**
 * One problem the queue can be filtered to.
 */
export type DefenseReviewProblemOption = {
  /** The problem. */
  target: NamedDefenseTarget
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
  students: DefenseReviewStudentOption[]
  /** Every problem one has been held against. */
  problems: DefenseReviewProblemOption[]
  /** Every set of examiner settings one has run on. */
  promptVersions: DefenseReviewPromptVersionOption[]
}

/**
 * The flaws a guard can catch in a draft, in display order.
 */
export const EXAMINER_FLAWS = [
  'wrongClaim',
  'leak',
  'withheldClose',
  'languageSwitch',
  'genderedAddress',
  'route',
] as const

/**
 * A flaw one of the examiner's guards can catch in a reply it drafted.
 */
export type ExaminerFlaw = (typeof EXAMINER_FLAWS)[number]
