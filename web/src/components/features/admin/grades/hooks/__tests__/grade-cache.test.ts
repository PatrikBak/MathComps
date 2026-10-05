// The grade cache: which cached copies of a grade its writer reaches and which it leaves where they are, and where
// its reader finds a grade.

import { QueryClient } from '@tanstack/react-query'
import { describe, expect, it } from 'vitest'

import type { NamedProblemTarget } from '@/components/features/defense/model/defense-types'

import { studentConversationsQueryKey } from '../../../conversation/hooks/conversation-cache'
import type { StudentConversations } from '../../../conversation/model/admin-conversation'
import type { GradingBoard } from '../../../grading-board/model/grading-types'
import type { Grade, PairIds } from '../../model/grade-types'
import { gradingBoardQueryKey, readCachedGrade, writeCachedGrade } from '../grade-cache'

/** The grade written in every case. */
const GRADE: Grade = {
  mark: 5,
  help: 1,
  internalComment: '',
  isFinal: false,
  updatedAt: '2026-09-27T10:00:00Z',
  updatedBy: { id: 'grader', username: 'Grader', email: null },
}

/** The first group's problem as a conversation names it, with everything a reader sees it by. */
const NAMED_PROBLEM: NamedProblemTarget = {
  kind: 'problem',
  problemId: 'p1',
  competitionSlug: 'mathilding',
  slug: 'p1',
  source: {
    season: { slug: '1', displayName: 'Season 1', fullName: null },
    startYear: 2026,
    competition: [{ slug: 'mathilding', displayName: 'Mathilding', fullName: null }],
    number: 1,
  },
}

/**
 * Builds one group's board holding two students on one problem, neither graded.
 *
 * @param name - What the group is called, which tells two boards apart.
 * @param problemId - The problem, which sits in this group's round and no other.
 *
 * @returns The board.
 */
function boardOf(name: string, problemId: string): GradingBoard {
  // One competition, two students, the one problem
  return {
    name: { sk: name, cs: name, en: name },
    opensAt: '2026-09-01T00:00:00Z',
    closesAt: '2026-09-14T22:00:00Z',
    competitions: [
      {
        roundId: `${name}-round`,
        category: 'elementary',
        problems: [{ id: problemId, slug: problemId, number: 1 }],
        entrants: [
          { user: { id: 'ada', username: 'Ada', email: null }, finishedAfterSeconds: 600 },
          { user: { id: 'bruno', username: 'Bruno', email: null }, finishedAfterSeconds: 900 },
        ],
        grades: [
          { userId: 'ada', problemId, conversationCount: 1, grade: null },
          { userId: 'bruno', problemId, conversationCount: 1, grade: null },
        ],
      },
    ],
  }
}

/**
 * Parks one graded student's conversations about the first group's problem in the cache, keyed by the problem
 * named in full rather than by the bare id a grade is written under.
 *
 * @param queryClient - The cache to park them in.
 * @param userId - The student.
 */
function cacheConversations(queryClient: QueryClient, userId: string): void {
  // One conversation, counted toward a grade nobody has given yet
  const conversations: StudentConversations = {
    conversations: [{ id: `${userId}-1`, createdAt: '2026-09-02T10:00:00Z' }],
    grading: {
      countingConversationIds: [`${userId}-1`],
      endedAt: '2026-09-02T12:00:00Z',
      grade: null,
      selfAssessment: null,
    },
  }

  // Kept under the problem carrying everything that names it
  queryClient.setQueryData(studentConversationsQueryKey(userId, NAMED_PROBLEM), conversations)
}

/**
 * Reads one grade off a cached board.
 *
 * @param queryClient - The cache.
 * @param groupSlug - The board's group.
 * @param address - Which grade.
 *
 * @returns The grade the board holds; undefined while no such board is cached or it holds no such grade.
 */
function boardGradeOf(
  queryClient: QueryClient,
  groupSlug: string,
  address: PairIds
): Grade | null | undefined {
  // The board as it is cached
  const board = queryClient.getQueryData<GradingBoard>(gradingBoardQueryKey(groupSlug))

  // The grade on it for that student and problem
  return board?.competitions[0].grades.find(
    (summary) => summary.userId === address.userId && summary.problemId === address.problemId
  )?.grade
}

describe('writeCachedGrade', () => {
  it("reaches the student's conversations and the board holding the grade, and no other grade", () => {
    // Two groups' boards, each over a problem of its own round
    const queryClient = new QueryClient()
    queryClient.setQueryData(gradingBoardQueryKey('first'), boardOf('first', 'p1'))
    queryClient.setQueryData(gradingBoardQueryKey('second'), boardOf('second', 'p2'))

    // Both students' conversations about the first group's problem
    cacheConversations(queryClient, 'ada')
    cacheConversations(queryClient, 'bruno')

    // Ada graded on the first group's problem
    writeCachedGrade(queryClient, { userId: 'ada', problemId: 'p1' }, GRADE)

    // Ada's grade read back where her conversations are kept, whichever way the problem was named there
    expect(readCachedGrade(queryClient, { userId: 'ada', problemId: 'p1' })).toEqual(GRADE)

    // Ada's grade on the first group's board
    expect(boardGradeOf(queryClient, 'first', { userId: 'ada', problemId: 'p1' })).toEqual(GRADE)

    // Ada's grade on the second group's problem, left as it was
    expect(boardGradeOf(queryClient, 'second', { userId: 'ada', problemId: 'p2' })).toBeNull()

    // Bruno's grade on the first group's problem, left as it was in both places
    expect(readCachedGrade(queryClient, { userId: 'bruno', problemId: 'p1' })).toBeNull()
    expect(boardGradeOf(queryClient, 'first', { userId: 'bruno', problemId: 'p1' })).toBeNull()
  })
})

describe('readCachedGrade', () => {
  it("reads a grade off the board where the student's conversations aren't cached", () => {
    // A board on which Ada is graded, with nobody's conversations cached
    const queryClient = new QueryClient()
    const board = boardOf('first', 'p1')
    board.competitions[0].grades[0].grade = GRADE
    queryClient.setQueryData(gradingBoardQueryKey('first'), board)

    // Ada's grade, read off the board
    expect(readCachedGrade(queryClient, { userId: 'ada', problemId: 'p1' })).toEqual(GRADE)

    // Bruno's, which the board holds as none
    expect(readCachedGrade(queryClient, { userId: 'bruno', problemId: 'p1' })).toBeNull()
  })
})
