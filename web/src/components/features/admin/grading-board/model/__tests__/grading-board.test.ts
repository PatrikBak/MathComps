import { describe, expect, it } from 'vitest'

import type { Grade } from '../../../grades/model/grade-types'
import {
  type BoardRow,
  buildRows,
  columnFinality,
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
 * Two problems, and an entrant of each kind: one graded final on both, one pre-graded with half points, and one not
 * graded yet.
 */
const COMPETITION: GradingCompetition = {
  roundId: 'round',
  category: 'elementary',
  problems: [
    { id: 'p1', slug: 'p-1', number: 1 },
    { id: 'p2', slug: 'p-2', number: 2 },
  ],
  entrants: [
    { user: { id: 'zora', username: 'Zora', email: null }, finishedAfterSeconds: 2400 },
    { user: { id: 'adam', username: 'Adam', email: null }, finishedAfterSeconds: 600 },
    { user: { id: 'emil', username: 'Emil', email: null }, finishedAfterSeconds: 1200 },
  ],
  grades: [
    summaryOf('zora', 'p1', 1, gradeOf(6, 0, true)),
    summaryOf('zora', 'p2', 2, gradeOf(3, 0, true)),
    summaryOf('adam', 'p1', 1, gradeOf(6, 1, false)),
    summaryOf('adam', 'p2', 0, null),
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

  it('keeps a total of 0 apart from having no total', () => {
    // Zora graded a final 0 on the first problem, and nothing else graded
    const competition = {
      ...COMPETITION,
      grades: [summaryOf('zora', 'p1', 1, gradeOf(0, 0, true))],
    }

    // Its rows, named by username
    const rows = buildRows(competition, indexGrades(competition), (user) => user.username ?? '')

    // A total of 0, where the others have none
    expect(rows.map((row) => row.total)).toEqual([null, null, 0])
  })

  it('calls a row final only once everything discussed is final', () => {
    // Every problem Zora discussed is final, and the one Adam discussed is still pre-graded
    expect(rowOf('Zora')?.isFinal).toBe(true)
    expect(rowOf('Adam')?.isFinal).toBe(false)
  })
})

describe('rankOf', () => {
  it('breaks a tie by the finishing time, sharing a place only when level on both', () => {
    // Totals of 9 finished at 100 s twice and at 50 s, a 5 finished earliest of all, a 0, and one not in yet that
    // finished before the 0
    const rows = [
      { ...ROWS[0], total: 9, finishedAfterSeconds: 100 },
      { ...ROWS[0], total: 9, finishedAfterSeconds: 100 },
      { ...ROWS[0], total: 9, finishedAfterSeconds: 50 },
      { ...ROWS[0], total: 5, finishedAfterSeconds: 10 },
      { ...ROWS[0], total: 0, finishedAfterSeconds: 20 },
      { ...ROWS[0], total: null, finishedAfterSeconds: 10 },
    ]

    // The earlier 9 first, the two level on both sharing second, the 5 fourth, the 0 fifth, and nobody placed
    // without a total
    expect(rows.map((row) => rankOf(rows, row))).toEqual([2, 2, 1, 4, 5, null])
  })
})

describe('sortRows', () => {
  it('keeps a row without a total last whichever way round', () => {
    // Best first
    const best = sortRows(ROWS, { by: 'total', ascending: false }).map((row) => row.name)

    // Worst first
    const worst = sortRows(ROWS, { by: 'total', ascending: true }).map((row) => row.name)

    // The totals turn round, and the one without a total stays behind them
    expect(best).toEqual(['Zora', 'Adam', 'Emil'])
    expect(worst).toEqual(['Adam', 'Zora', 'Emil'])
  })

  it('puts the earlier finisher ahead on a tie, with names settling a shared place', () => {
    // Three level on the total, Cyril finishing first and the other two level on both
    const rows = [
      { ...ROWS[0], name: 'Adam', total: 9, finishedAfterSeconds: 300 },
      { ...ROWS[0], name: 'Bea', total: 9, finishedAfterSeconds: 300 },
      { ...ROWS[0], name: 'Cyril', total: 9, finishedAfterSeconds: 100 },
    ]

    // Best first
    const best = sortRows(rows, { by: 'total', ascending: false }).map((row) => row.name)

    // Worst first
    const worst = sortRows(rows, { by: 'total', ascending: true }).map((row) => row.name)

    // The earlier finisher ahead, turned round with the totals, and the shared place read by name either way
    expect(best).toEqual(['Cyril', 'Adam', 'Bea'])
    expect(worst).toEqual(['Adam', 'Bea', 'Cyril'])
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

describe('columnFinality', () => {
  it('lists the marks not yet final, counting the pairs without a mark beside them', () => {
    // Adam pre-graded on the first problem, Zora final, Emil not graded
    expect(columnFinality(COMPETITION, 'p1', GRADES)).toEqual({
      kind: 'ready',
      userIds: ['adam'],
      unmarked: 1,
    })
  })

  it('is idle while a pair without a mark sits beside final ones', () => {
    // Zora final on the second problem, Emil not graded
    expect(columnFinality(COMPETITION, 'p2', GRADES)).toEqual({ kind: 'idle' })
  })

  it('is done once every pair with a conversation is final', () => {
    // Emil graded final on the second problem too, Adam never having discussed it
    const competition = {
      ...COMPETITION,
      grades: COMPETITION.grades.map((summary) =>
        summary.userId === 'emil' && summary.problemId === 'p2'
          ? { ...summary, grade: gradeOf(2, 0, true) }
          : summary
      ),
    }

    // Nothing left to make final
    expect(columnFinality(competition, 'p2', indexGrades(competition))).toEqual({ kind: 'done' })
  })

  it('is idle, not done, where nobody discussed the problem', () => {
    // A third problem nobody held a conversation about
    const competition = {
      ...COMPETITION,
      problems: [...COMPETITION.problems, { id: 'p3', slug: 'p-3', number: 3 }],
      grades: [...COMPETITION.grades, summaryOf('zora', 'p3', 0, null)],
    }

    // Nothing to be final about
    expect(columnFinality(competition, 'p3', indexGrades(competition))).toEqual({ kind: 'idle' })
  })
})
