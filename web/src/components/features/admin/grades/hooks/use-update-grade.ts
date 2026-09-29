import { useAuth } from '@clerk/nextjs'
import { useQueryClient } from '@tanstack/react-query'
import { useTranslations } from 'next-intl'
import { useCallback, useState } from 'react'

import type { UserIdentity } from '@/components/features/admin/model/user-identity'
import { useUserProfile } from '@/components/features/profile/hooks/use-user-profile'
import { useOptimisticMutation } from '@/hooks/use-optimistic-mutation'
import { createSettlingWrites } from '@/lib/settling-writes'

import { applyGradeChange } from '../model/grade-change'
import { type Grade, type GradeChange, type PairIds, pairKey } from '../model/grade-types'
import { updateGrade } from '../services/grade-service'
import { readCachedGrade, writeCachedGrade } from './grade-cache'

/**
 * One change to one entrant's grade on one problem.
 */
type GradeWrite = PairIds & {
  /** What changed. */
  change: GradeChange
}

/**
 * What {@link useUpdateGrade} hands back.
 */
export type UseUpdateGradeResult = {
  /**
   * Changes one entrant's grade on one problem, showing it before the server has it. Resolves to whether the
   * server took the change.
   */
  changeGrade: (userId: string, problemId: string, change: GradeChange) => Promise<boolean>
}

/**
 * Changes grades.
 *
 * Every change lands wherever the grade is cached at once. A refused change puts back what the server still
 * holds, unless a later change is still settling and decides instead.
 *
 * @returns The change as described by {@link UseUpdateGradeResult}.
 */
export function useUpdateGrade(): UseUpdateGradeResult {
  // Grades copy
  const t = useTranslations('admin.grades')

  // The cache the grades live in
  const queryClient = useQueryClient()

  // Who is signed in
  const { userId } = useAuth()

  // Their profile, which carries the name and email they go by
  const profile = useUserProfile()

  // Who is grading, which the grade names until the server's own answer names them properly
  const grader: UserIdentity = {
    id: userId ?? '',
    username: profile.username,
    email: profile.email,
  }

  // The changes still settling, per grade
  const [settling] = useState(() => createSettlingWrites<Grade | null>())

  // The write itself, which lands in the cache before the server answers
  const { mutateAsync } = useOptimisticMutation<Grade | null, GradeWrite, void>({
    apiFn: (apiCall, { userId: studentId, problemId, change }) =>
      updateGrade(apiCall, problemId, studentId, change),
    // Changes reach the server in the order they were made, so the last to land is the one that decides
    scope: { id: 'admin-grading-grade' },
    onMutate: ({ userId: studentId, problemId, change }) => {
      // The student and problem the grade belongs to
      const address: PairIds = { userId: studentId, problemId }

      // Which grade the changes settling on it are counted under
      const key = pairKey(studentId, problemId)

      // The grade as it shows now
      const current = readCachedGrade(queryClient, address)

      // One more change settling on it
      settling.begin(key)

      // The grade before the first of those changes, for a refused one to put back
      settling.holdBefore(key, current)

      // The grade as the change leaves it, straight away
      writeCachedGrade(
        queryClient,
        address,
        applyGradeChange(current, change, grader, new Date().toISOString())
      )
    },
    onSuccess: (grade, { userId: studentId, problemId }) => {
      // The server's answer, which a change refused behind this one now falls back to
      const isLastToSettle = settling.land(pairKey(studentId, problemId), grade)

      // Nothing behind it is left to decide, so the grade says what the server actually holds
      if (isLastToSettle) {
        writeCachedGrade(queryClient, { userId: studentId, problemId }, grade)
      }
    },
    onError: (_error, { userId: studentId, problemId }) => {
      // What the server still holds, unless a change behind this one decides
      const confirmed = settling.refuse(pairKey(studentId, problemId))

      // Put it back, where it falls to this change to
      if (confirmed !== null) {
        writeCachedGrade(queryClient, { userId: studentId, problemId }, confirmed.state)
      }
    },
    onSettled: (_grade, _error, { userId: studentId, problemId }) =>
      // One change fewer settling, whichever way it went
      settling.settle(pairKey(studentId, problemId)),
    authReason: t('saveFailed'),
    errorMessage: t('saveFailed'),
  })

  // Changes one grade, telling whether the server took the change
  const changeGrade = useCallback(
    (studentId: string, problemId: string, change: GradeChange) =>
      mutateAsync({ userId: studentId, problemId, change }).then(
        // Taken, unless the sign-in check held it back before it was ever sent, which answers with nothing
        (grade) => grade !== undefined,
        // Refused, or lost on the way
        () => false
      ),
    [mutateAsync]
  )

  // The way to change a grade
  return { changeGrade }
}
