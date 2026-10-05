import type { UserIdentity } from '@/components/features/admin/model/user-identity'

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
 * One entrant's grade on a problem named elsewhere.
 */
export type StudentGrade = {
  /** The entrant. */
  userId: string
  /** Where the grade stands. */
  grade: Grade
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
 * The score a grade gives.
 * @param grade - The grade; null while none is given.
 * @returns The mark less half the help; null while there is no mark.
 */
export function scoreOf(grade: Grade | null): number | null {
  // Every point Mathilda gave counts half
  return grade === null || grade.mark === null ? null : grade.mark - grade.help / 2
}

/** The full mark a problem can earn. */
export const MAX_MARK = 6

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
 * The ids naming one entrant on one problem, which is what a grade belongs to.
 */
export type PairIds = {
  /** The entrant. */
  userId: string
  /** The problem. */
  problemId: string
}

/** What stands between the two ids of a pair's key, a character neither id holds. */
const PAIR_KEY_SEPARATOR = '|'

/**
 * The key naming one entrant on one problem.
 * @param userId - The entrant.
 * @param problemId - The problem.
 * @returns The key.
 */
export function pairKey(userId: string, problemId: string): string {
  // Both ids, split by the separator
  return `${userId}${PAIR_KEY_SEPARATOR}${problemId}`
}

/**
 * Reads a key {@link pairKey} built back into the ids it was built from.
 * @param key - The key.
 * @returns The entrant's id and the problem's.
 */
export function splitPairKey(key: string): PairIds {
  // Where the entrant's id ends
  const separatorIndex = key.indexOf(PAIR_KEY_SEPARATOR)

  // The ids either side of it
  return { userId: key.slice(0, separatorIndex), problemId: key.slice(separatorIndex + 1) }
}
