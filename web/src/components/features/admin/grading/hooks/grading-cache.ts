import type { QueryClient, QueryKey } from '@tanstack/react-query'

import type { Grade, GradingBoard } from '../model/grading-types'

/** The root every grading query key hangs off. */
const GRADING_QUERY_KEY = ['adminGrading'] as const

/**
 * Builds the query key for one group's board.
 *
 * @param groupSlug - What addresses the group.
 * @returns The query key.
 */
export function gradingBoardQueryKey(groupSlug: string): QueryKey {
  // One board per group
  return [...GRADING_QUERY_KEY, 'board', groupSlug] as const
}

/**
 * Builds the query key for everything one entrant's grade on one problem is read from.
 *
 * @param problemId - The problem.
 * @param userId - The entrant.
 * @returns The query key.
 */
export function gradeDetailQueryKey(problemId: string, userId: string): QueryKey {
  // One reading per entrant and problem
  return [...GRADING_QUERY_KEY, 'detail', problemId, userId] as const
}

/**
 * Where one entrant's grade on one problem sits on its board.
 */
export type CachedGradeAddress = {
  /** What addresses the group. */
  groupSlug: string
  /** The entrant. */
  userId: string
  /** The problem. */
  problemId: string
}

/**
 * Reads one grade off its board.
 *
 * @param queryClient - The cache.
 * @param address - Which grade.
 * @returns The grade; null while none is given, and while the board isn't cached.
 */
export function readCachedGrade(
  queryClient: QueryClient,
  address: CachedGradeAddress
): Grade | null {
  // The board the grade sits on
  const board = queryClient.getQueryData<GradingBoard>(gradingBoardQueryKey(address.groupSlug))

  // The grade among every competition's grades
  return (
    board?.competitions
      .flatMap((competition) => competition.grades)
      .find(
        (summary) => summary.userId === address.userId && summary.problemId === address.problemId
      )?.grade ?? null
  )
}

/**
 * Rewrites one grade on its board, where the board holds it.
 *
 * @param queryClient - The cache.
 * @param address - Which grade.
 * @param grade - What the grade now says; null for none given.
 */
export function writeCachedGrade(
  queryClient: QueryClient,
  address: CachedGradeAddress,
  grade: Grade | null
): void {
  // The board with that one grade replaced, and every other left as it was
  queryClient.setQueryData<GradingBoard>(gradingBoardQueryKey(address.groupSlug), (board) =>
    // Nothing to rewrite while the board isn't cached
    board === undefined
      ? undefined
      : {
          ...board,
          competitions: board.competitions.map((competition) => ({
            ...competition,
            grades: competition.grades.map((summary) =>
              summary.userId === address.userId && summary.problemId === address.problemId
                ? { ...summary, grade }
                : summary
            ),
          })),
        }
  )
}
