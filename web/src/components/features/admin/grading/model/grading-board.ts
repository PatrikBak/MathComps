import type { UserIdentity } from '@/components/features/admin/model/user-identity'
import { assertNever } from '@/components/shared/utils/assert-never'

import {
  type GradeSummary,
  type GradingCompetition,
  type GradingPair,
  pairKey,
  scoreOf,
} from './grading-types'

/**
 * Which column the rows are ordered by.
 */
export type SortBy = 'name' | 'total'

/**
 * Which way each column reads when it is first pressed: names from A, totals from the best.
 */
const STARTS_ASCENDING: Record<SortBy, boolean> = {
  name: true,
  total: false,
}

/**
 * How the rows are ordered: which column, and which way round.
 */
export type BoardSort = {
  /** The column. */
  by: SortBy
  /** Whether the smallest comes first. */
  ascending: boolean
}

/**
 * One entrant's row on the board.
 */
export type BoardRow = {
  /** The entrant. */
  user: UserIdentity
  /** What the board calls them. */
  name: string
  /** Their score summed over every problem graded so far; null while none is. */
  total: number | null
  /** Whether they discussed at least one problem, and every one they discussed has a final grade. */
  isFinal: boolean
}

/**
 * How far grading a competition has got.
 */
export type GradingProgress = {
  /** How many pairs have a conversation. */
  total: number
  /** How many pairs with a conversation carry a mark. */
  graded: number
  /** How many pairs with a conversation are final. */
  final: number
}

/**
 * Files every entrant's grade on every problem under its {@link pairKey}.
 * @param competition - The competition.
 * @returns The grades, by pair.
 */
export function indexGrades(competition: GradingCompetition): ReadonlyMap<string, GradeSummary> {
  // Each grade under the entrant and problem it belongs to
  return new Map(
    competition.grades.map((summary) => [pairKey(summary.userId, summary.problemId), summary])
  )
}

/**
 * Files every entrant on every problem under its {@link pairKey}.
 * @param competition - The competition.
 * @returns The pairs, by key.
 */
export function indexPairs(competition: GradingCompetition): ReadonlyMap<string, GradingPair> {
  // Each entrant on each problem, under its pair key
  return new Map(
    competition.entrants.flatMap((user) =>
      competition.problems.map(
        (problem) => [pairKey(user.id, problem.id), { user, problem }] as const
      )
    )
  )
}

/**
 * Builds every entrant's row, in the order their names read.
 *
 * @param competition - The competition.
 * @param grades - The competition's grades, by pair.
 * @param nameOf - What the board calls an entrant.
 *
 * @returns The rows, by name.
 */
export function buildRows(
  competition: GradingCompetition,
  grades: ReadonlyMap<string, GradeSummary>,
  nameOf: (user: UserIdentity) => string
): BoardRow[] {
  // One row per entrant
  const rows = competition.entrants.map((user) => {
    // Their grades, problem by problem, including the problems they never discussed
    const summaries = competition.problems.map((problem) =>
      grades.get(pairKey(user.id, problem.id))
    )

    // The scores of the problems graded so far
    const scores = summaries
      .map((summary) => scoreOf(summary?.grade ?? null))
      .filter((score): score is number => score !== null)

    // The problems they discussed
    const discussed = summaries.filter((summary) => (summary?.conversationCount ?? 0) > 0)

    // Nothing graded yet has no total, which a 0 would claim
    const total = scores.length === 0 ? null : scores.reduce((sum, score) => sum + score, 0)

    // Final only once there is something to be final about, and all of it is
    const isFinal =
      discussed.length > 0 && discussed.every((summary) => summary?.grade?.isFinal === true)

    // The row
    return { user, name: nameOf(user), total, isFinal }
  })

  // Read by name
  return rows.sort((first, second) => first.name.localeCompare(second.name))
}

/**
 * Places an entrant by their total, sharing a place on a tie (1, 2, 2, 4).
 *
 * @param rows - Every row.
 * @param total - The total to place.
 *
 * @returns The place; null for an entrant with no mark yet.
 */
export function rankOf(rows: readonly BoardRow[], total: number | null): number | null {
  // Unplaced until there is something to place by
  if (total === null) return null

  // One more than everybody strictly ahead
  return 1 + rows.filter((other) => other.total !== null && other.total > total).length
}

/**
 * Orders the rows as asked. The unplaced stay last either way round, and a tie on the total falls back to names.
 *
 * @param rows - The rows.
 * @param sort - The order asked for.
 *
 * @returns The rows in that order.
 */
export function sortRows(rows: readonly BoardRow[], sort: BoardSort): BoardRow[] {
  // Which way round the column reads
  const direction = sort.ascending ? 1 : -1

  // The rows in the order asked for
  return [...rows].sort((first, second) => {
    // Which column decides
    switch (sort.by) {
      // By name, which every row has
      case 'name':
        return direction * first.name.localeCompare(second.name)

      // By total
      case 'total':
        // The rows without one staying last whichever way round
        if (first.total === null || second.total === null) {
          return (first.total === null ? 1 : 0) - (second.total === null ? 1 : 0)
        }

        // The totals themselves, and names where they tie
        return direction * (first.total - second.total) || first.name.localeCompare(second.name)

      // Every column is handled above
      default:
        return assertNever(sort.by)
    }
  })
}

/**
 * Works out the order after a column header is pressed.
 *
 * @param current - The order standing.
 * @param by - The column pressed.
 *
 * @returns The column already ordering the rows turned round; another one the way it first reads.
 */
export function nextSort(current: BoardSort, by: SortBy): BoardSort {
  // The same column, turned round, or a new one from where it naturally starts
  return current.by === by
    ? { by, ascending: !current.ascending }
    : { by, ascending: STARTS_ASCENDING[by] }
}

/**
 * Lays out the walk through a competition: problem by problem, down each column in the rows' order, stopping only
 * on pairs with a conversation.
 *
 * @param competition - The competition.
 * @param rows - The competition's rows in name order, which stays put while grading moves the totals.
 * @param grades - The competition's grades, by pair.
 *
 * @returns Every pair to grade, as keys, in walking order.
 */
export function walkOrder(
  competition: GradingCompetition,
  rows: readonly BoardRow[],
  grades: ReadonlyMap<string, GradeSummary>
): string[] {
  // Down each problem's column, skipping the entrants who never discussed it
  return competition.problems.flatMap((problem) =>
    rows
      .map((row) => pairKey(row.user.id, problem.id))
      .filter((key) => (grades.get(key)?.conversationCount ?? 0) > 0)
  )
}

/**
 * Counts how far grading a competition has got.
 *
 * @param order - Every pair to grade, as keys.
 * @param grades - The grades, by pair.
 *
 * @returns The progress, as {@link GradingProgress} counts it.
 */
export function countProgress(
  order: readonly string[],
  grades: ReadonlyMap<string, GradeSummary>
): GradingProgress {
  // The grades of the pairs to grade
  const given = order.map((key) => grades.get(key)?.grade ?? null)

  // How many there are, those with a mark, and those settled
  return {
    total: order.length,
    graded: given.filter((grade) => grade?.mark != null).length,
    final: given.filter((grade) => grade?.isFinal === true).length,
  }
}
