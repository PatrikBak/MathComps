import type { UserIdentity } from '@/components/features/admin/model/user-identity'
import type { StoredTurn } from '@/components/features/defense/model/defense-types'
import type { HostedCompetitionCategory } from '@/components/features/hosted-competitions/model/hosted-competition-types'

/**
 * One problem of a competition being graded.
 */
type GradingProblem = {
  /** Stable identifier. */
  id: string
  /** Its slug. */
  slug: string
  /** Its 1-based position in the competition. */
  number: number
}

/**
 * Where one entrant's grade on one problem stands.
 */
export type Grade = {
  /** The whole mark; null while none is given. */
  mark: number | null
  /** The part of the mark that came from Mathilda, 0 to the mark. */
  help: number
  /** A comment only graders read. */
  internalComment: string
  /** Whether it is final rather than pre-graded. */
  isFinal: boolean
  /** When it last changed, as an ISO-8601 string. */
  updatedAt: string
  /** The grader who changed it last. */
  updatedBy: UserIdentity
}

/**
 * One entrant's grade on one problem, with how many conversations it is read from.
 */
export type GradeSummary = {
  /** The entrant. */
  userId: string
  /** The problem. */
  problemId: string
  /** How many conversations the entrant held about the problem while their entry counted. */
  conversationCount: number
  /** Where it stands; null while nobody has given one. */
  grade: Grade | null
}

/**
 * One competition of a group, with its graded entrants and their grade on every problem.
 */
export type GradingCompetition = {
  /** The round that is the competition. */
  roundId: string
  /** Which level it runs at. */
  category: HostedCompetitionCategory
  /** Its problems in order. */
  problems: GradingProblem[]
  /** Everyone graded in it. */
  entrants: UserIdentity[]
  /** Every entrant's grade on every problem. */
  grades: GradeSummary[]
}

/**
 * One conversation an entrant held with Mathilda about a problem.
 */
type GradingConversation = {
  /** Stable identifier. */
  id: string
  /** When it started, as an ISO-8601 string. */
  createdAt: string
  /** The statement as the student saw it. */
  statement: string
  /** The reference Mathilda held. */
  reference: string
  /** The conversation in order. */
  turns: StoredTurn[]
}

/**
 * What a student said about their own solution to one problem.
 */
export type SelfAssessment = {
  /** What they said, in their own words. */
  comment: string
  /** When they last changed it, as an ISO-8601 string. */
  updatedAt: string
}

/**
 * Everything one entrant's grade on one problem is read from.
 */
export type GradeDetail = {
  /** Their conversations about the problem, oldest first. */
  conversations: GradingConversation[]
  /** What they said about their own solution; null when they said nothing. */
  selfAssessment: SelfAssessment | null
}

/**
 * A new mark, wrapped so that taking the mark back can be told apart from leaving it alone.
 */
type GradeMarkChange = {
  /** The mark; null to take it back. */
  value: number | null
}

/**
 * A change to one grade, carrying only what changed. A field left out keeps its value, as far as the new mark
 * allows.
 */
export type GradeChange = {
  /** The new mark. */
  mark?: GradeMarkChange
  /** The new part of the mark that came from Mathilda. */
  help?: number
  /** The new comment for graders. */
  internalComment?: string
  /** Whether it is now final. */
  isFinal?: boolean
}

/**
 * One entrant on one problem: the unit a grade is given to.
 */
export type GradingPair = {
  /** The entrant. */
  user: UserIdentity
  /** The problem. */
  problem: GradingProblem
}

/**
 * The score a grade gives.
 * @param grade - The grade; null while none is given.
 * @returns The mark less half the help; null while there is no mark.
 */
export function scoreOf(grade: Grade | null): number | null {
  // Every point Mathilda gave counts half
  return grade === null || grade.mark === null ? null : grade.mark - grade.help / 2
}

/**
 * Formats a score to at most one decimal, the half points being the only fractions there are.
 * @param score - The score.
 * @returns The score as text.
 */
export function formatScore(score: number): string {
  // Whole points bare, half points with their one decimal
  return Number.isInteger(score) ? String(score) : score.toFixed(1)
}

/**
 * The key naming one entrant on one problem.
 * @param userId - The entrant.
 * @param problemId - The problem.
 * @returns The key.
 */
export function pairKey(userId: string, problemId: string): string {
  // Both ids, split by a character neither id holds
  return `${userId}|${problemId}`
}
