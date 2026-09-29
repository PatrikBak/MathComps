import type { UserIdentity } from '@/components/features/admin/model/user-identity'
import type { DefenseSessionTarget } from '@/components/features/defense/model/defense-types'
import { useApiQuery } from '@/hooks/use-api-query'
import { BackendApiError } from '@/lib/api/api-error'
import { cachePolicy } from '@/lib/query-config'
import type { QueryUiState } from '@/lib/query-ui-state'

import type { StudentConversations } from '../model/admin-conversation'
import { fetchStudentConversations } from '../services/conversation-service'
import { studentConversationsQueryKey } from './conversation-cache'

/**
 * One student on one problem.
 */
export type StudentProblem = {
  /** The student. */
  user: UserIdentity
  /** The problem. */
  target: DefenseSessionTarget
}

/**
 * Stands in for the student and problem while neither is known, so the idle cache entry is named rather than
 * blank.
 */
const NO_STUDENT_PROBLEM: StudentProblem = {
  user: { id: 'none', username: null, email: null },
  target: { kind: 'problem', problemId: 'none' },
}

/**
 * What {@link useStudentConversations} hands back.
 */
type UseStudentConversationsResult = {
  /** The student's conversations about the problem and their grading; null until they have been read. */
  studentConversations: StudentConversations | null
  /** The state of the fetch. */
  uiState: QueryUiState
}

/**
 * Reads every conversation one student held about one problem, and where their grade on it stands.
 *
 * @param studentProblem - The student and problem, or null while they are not known.
 * @returns The conversations as described by {@link UseStudentConversationsResult}.
 */
export function useStudentConversations(
  studentProblem: StudentProblem | null
): UseStudentConversationsResult {
  // The student and problem the cache entry is kept under, the stand-in while neither is known
  const { user, target } = studentProblem ?? NO_STUDENT_PROBLEM

  // The conversations and the grading
  const { data, uiState } = useApiQuery({
    queryKey: studentConversationsQueryKey(user.id, target),
    fetch: (apiCall) => {
      // The gate below keeps this from running with nothing known, so reaching here is a bug
      if (studentProblem === null) {
        throw new BackendApiError({ message: 'No student is open', errorCode: 'SERVER_ERROR' })
      }

      // The student's conversations about the problem
      return fetchStudentConversations(apiCall, user.id, target)
    },
    // The list is an admin's own read, so it is made as them
    requireAuth: true,
    // Nothing is read while nobody is known
    enabled: studentProblem !== null,
    ...cachePolicy.userData,
  })

  // The conversations once they have arrived, and how the fetch is going meanwhile
  return { studentConversations: data ?? null, uiState }
}
