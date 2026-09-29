import type { QueryClient, QueryKey } from '@tanstack/react-query'

import { studentConversationsQueryKey } from '../../conversation/hooks/conversation-cache'
import type { StudentConversations } from '../../conversation/model/admin-conversation'
import type { GradingBoard } from '../../grading-board/model/grading-types'
import type { Grade, PairIds } from '../model/grade-types'

/** The prefix every group's board hangs off, so one call can match all of them. */
const BOARD_QUERY_KEY = ['adminGrading', 'board'] as const

/**
 * Builds the query key for one group's board.
 *
 * @param groupSlug - What addresses the group.
 * @returns The query key.
 */
export function gradingBoardQueryKey(groupSlug: string): QueryKey {
  // One board per group
  return [...BOARD_QUERY_KEY, groupSlug] as const
}

/**
 * Builds the key of the student's conversations about the problem, which carry their grade on it.
 *
 * @param address - Which grade.
 * @returns The query key.
 */
function studentConversationsKeyOf(address: PairIds): QueryKey {
  // A graded problem is always an archive one
  return studentConversationsQueryKey(address.userId, {
    kind: 'problem',
    problemId: address.problemId,
  })
}

/**
 * Reads one grade as the student's conversations about the problem hold it.
 *
 * @param queryClient - The cache.
 * @param address - Which grade.
 * @returns The grade; null while none is given, and while nothing holds it.
 */
export function readCachedGrade(queryClient: QueryClient, address: PairIds): Grade | null {
  // The student's conversations about the problem, with the grading beside them
  const cached = queryClient.getQueryData<StudentConversations>(studentConversationsKeyOf(address))

  // The grade, if they are cached and graded
  return cached?.grading?.grade ?? null
}

/**
 * Rewrites one grade wherever it is cached: beside the student's conversations about the problem, and on every
 * board that holds it.
 *
 * @param queryClient - The cache.
 * @param address - Which grade.
 * @param grade - What the grade now says; null for none given.
 */
export function writeCachedGrade(
  queryClient: QueryClient,
  address: PairIds,
  grade: Grade | null
): void {
  // The grading beside the student's conversations, where there is one to rewrite
  queryClient.setQueryData<StudentConversations>(studentConversationsKeyOf(address), (cached) =>
    // Nothing to rewrite while they aren't cached, or while nobody grades them
    cached?.grading == null ? cached : { ...cached, grading: { ...cached.grading, grade } }
  )

  // Every cached board, with that one grade replaced and every other left as it was
  queryClient.setQueriesData<GradingBoard>({ queryKey: BOARD_QUERY_KEY }, (board) =>
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
