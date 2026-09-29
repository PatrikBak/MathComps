import { describe, expect, it } from 'vitest'

import type { Grade } from '../../../grades/model/grade-types'
import {
  type BoardRow,
  buildRows,
  countProgress,
  indexGrades,
  rankOf,
  sortRows,
  walkOrder,
} from '../grading-board'
import type { GradeSummary, GradingCompetition } from '../grading-types'

/** The grader every grade here was last changed by. */
const GRADER = { id: 'grader', username: 'Grader', email: null }

/**
 * Builds a grade with a mark.
 * @param mark - The mark.
 * @param help - How much of the mark came from Mathilda.
 * @param isFinal - Whether the grade is final.
 * @returns The grade.
 */
function gradeOf(mark: number, help: number, isFinal: boolean): Grade {
  // A grade last changed by the one grader
  return {
    mark,
    help,
    internalComment: '',
    isFinal,
    updatedAt: '2026-09-27T10:00:00Z',
    updatedBy: GRADER,
  }
}

/**
 * Builds one entrant's grade on one problem.
 * @param userId - The entrant.
 * @param problemId - The problem.
 * @param conversationCount - How many conversations the entrant held about the problem.
 * @param grade - The grade; null while none is given.
 * @returns The summary.
 */
function summaryOf(
  userId: string,
  problemId: string,
  conversationCount: number,
  grade: Grade | null
): GradeSummary {
  // The summary
  return { userId, problemId, conversationCount, grade }
}

/**
 * Two problems, and an entrant of each kind: one graded final on both, one pre-graded with half points, one who spoke on
 * neither, and one not graded yet.
 */
const COMPETITION: GradingCompetition = {
  roundId: 'round',
  category: 'elementary',
  problems: [
    { id: 'p1', slug: 'p-1', number: 1 },
    { id: 'p2', slug: 'p-2', number: 2 },
  ],
  entrants: [
    { id: 'zora', username: 'Zora', email: null },
    { id: 'adam', username: 'Adam', email: null },
    { id: 'mute', username: 'Mute', email: null },
    { id: 'emil', username: 'Emil', email: null },
  ],
  grades: [
    summaryOf('zora', 'p1', 1, gradeOf(6, 0, true)),
    summaryOf('zora', 'p2', 2, gradeOf(3, 0, true)),
    summaryOf('adam', 'p1', 1, gradeOf(6, 1, false)),
    summaryOf('adam', 'p2', 0, null),
    summaryOf('mute', 'p1', 0, null),
    summaryOf('mute', 'p2', 0, null),
    summaryOf('emil', 'p1', 1, null),
    summaryOf('emil', 'p2', 1, null),
  ],
}

/** The competition's grades, by pair. */
const GRADES = indexGrades(COMPETITION)

/** The competition's rows, named by username. */
const ROWS = buildRows(COMPETITION, GRADES, (user) => user.username ?? '')

/**
 * Finds a row by name.
 * @param name - The name.
 * @returns The row; undefined when no row carries the name.
 */
function rowOf(name: string): BoardRow | undefined {
  // The one row carrying that name
  return ROWS.find((row) => row.name === name)
}

describe('buildRows', () => {
  it('sums the scores of what is graded, counting help as half', () => {
    // 6 + 3, and 6 less half of 1
    expect(rowOf('Zora')?.total).toBe(9)
    expect(rowOf('Adam')?.total).toBe(5.5)

    // Nothing graded, so no total rather than a 0
    expect(rowOf('Emil')?.total).toBeNull()
  })

  it('calls a row final only once everything discussed is final', () => {
    // Every problem Zora discussed is final, and the one Adam discussed is still pre-graded
    expect(rowOf('Zora')?.isFinal).toBe(true)
    expect(rowOf('Adam')?.isFinal).toBe(false)

    // Nothing discussed, so nothing to be final about
    expect(rowOf('Mute')?.isFinal).toBe(false)
  })
})

describe('rankOf', () => {
  it('shares a place on a tie and places nobody without a total', () => {
    // Totals of 9, 9, 5, and one not in yet
    const rows = [9, 9, 5, null].map((total) => ({ ...ROWS[0], total }))

    // First, first, third, and unplaced
    expect(rows.map((row) => rankOf(rows, row.total))).toEqual([1, 1, 3, null])
  })
})

describe('sortRows', () => {
  it('keeps the rows without a total last whichever way round', () => {
    // Best first
    const best = sortRows(ROWS, { by: 'total', ascending: false }).map((row) => row.name)

    // Worst first
    const worst = sortRows(ROWS, { by: 'total', ascending: true }).map((row) => row.name)

    // The totals turn round, and the two without one stay behind them in the order they came
    expect(best).toEqual(['Zora', 'Adam', 'Emil', 'Mute'])
    expect(worst).toEqual(['Adam', 'Zora', 'Emil', 'Mute'])
  })
})

describe('walkOrder', () => {
  it('walks down each problem by name, stopping only where the entrant held a conversation', () => {
    // Problem 1: Adam, Emil and Zora spoke on it; problem 2: Emil and Zora
    expect(walkOrder(COMPETITION, ROWS, GRADES)).toEqual([
      'adam|p1',
      'emil|p1',
      'zora|p1',
      'emil|p2',
      'zora|p2',
    ])
  })
})

describe('countProgress', () => {
  it('counts the pairs carrying a mark, and those final', () => {
    // Three of the five pairs with a conversation carry a mark, two of them final
    expect(countProgress(walkOrder(COMPETITION, ROWS, GRADES), GRADES)).toEqual({
      total: 5,
      graded: 3,
      final: 2,
    })
  })
})
