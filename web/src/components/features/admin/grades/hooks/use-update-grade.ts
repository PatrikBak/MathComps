import { useAuth } from '@clerk/nextjs'
import { useQueryClient } from '@tanstack/react-query'
import { useTranslations } from 'next-intl'
import { useCallback, useState } from 'react'

import type { UserIdentity } from '@/components/features/admin/model/user-identity'
import { useUserProfile } from '@/components/features/profile/hooks/use-user-profile'
import { useOptimisticMutation } from '@/hooks/use-optimistic-mutation'
import { createSettlingWrites } from '@/lib/settling-writes'

import { applyGradeChange } from '../model/grade-change'
import {
  type Grade,
  type GradeChange,
  type PairIds,
  pairKey,
  type StudentGrade,
} from '../model/grade-types'
import { finalizeGrades as sendFinalizeGrades, updateGrade } from '../services/grade-service'
import { readCachedGrade, writeCachedGrade } from './grade-cache'

/**
 * One change to one entrant's grade on one problem.
 */
type GradeWrite = PairIds & {
  /** What changed. */
  change: GradeChange
}

/**
 * Several entrants' grades on one problem, made final together.
 */
type FinalWrite = {
  /** The problem. */
  problemId: string
  /** The entrants. */
  userIds: string[]
}

/** What makes a grade final, and moves nothing else. */
const MAKE_FINAL: GradeChange = { isFinal: true }

/** The scope every grade write shares, so they reach the server in the order they were made. */
const GRADE_WRITES_SCOPE = { id: 'admin-grading-grade' }

/**
 * What {@link useUpdateGrade} hands back.
 */
export type UseUpdateGradeResult = {
  /**
   * Changes one entrant's grade on one problem, showing it before the server has it. Resolves to whether the
   * server took the change.
   */
  changeGrade: (userId: string, problemId: string, change: GradeChange) => Promise<boolean>
  /**
   * Makes several entrants' marked grades on one problem final together, showing it before the server has it.
   */
  finalizeGrades: (problemId: string, userIds: string[]) => void
}

/**
 * Changes grades.
 *
 * Every change lands wherever the grade is cached at once. A refused change puts back what the server still
 * holds, unless a later change is still settling and decides instead. Making several grades final counts as one
 * change on each of them.
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

  // A function which shows a change to one grade before the server has it
  const showChange = (address: PairIds, change: GradeChange) => {
    // Which grade the changes settling on it are counted under
    const key = pairKey(address.userId, address.problemId)

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
  }

  // A function which takes the server's answer to a change to one grade
  const landChange = (address: PairIds, grade: Grade | null) => {
    // The answer, which a change refused behind this one now falls back to
    const isLastToSettle = settling.land(pairKey(address.userId, address.problemId), grade)

    // Nothing behind it is left to decide, so the grade says what the server actually holds
    if (isLastToSettle) writeCachedGrade(queryClient, address, grade)
  }

  // A function which puts a grade back after the server refused a change to it
  const refuseChange = (address: PairIds) => {
    // What the server still holds, unless a change behind this one decides
    const confirmed = settling.refuse(pairKey(address.userId, address.problemId))

    // Put it back, where it falls to this change to
    if (confirmed !== null) writeCachedGrade(queryClient, address, confirmed.state)
  }

  // The write itself, which lands in the cache before the server answers
  const { mutateAsync } = useOptimisticMutation<Grade | null, GradeWrite, void>({
    apiFn: (apiCall, { userId: studentId, problemId, change }) =>
      updateGrade(apiCall, problemId, studentId, change),
    // Changes reach the server in the order they were made, so the last to land is the one that decides
    scope: GRADE_WRITES_SCOPE,
    onMutate: ({ userId: studentId, problemId, change }) =>
      // The grade as the change leaves it, straight away
      showChange({ userId: studentId, problemId }, change),
    onSuccess: (grade, address) =>
      // The server's answer
      landChange(address, grade),
    onError: (_error, address) =>
      // What the server still holds
      refuseChange(address),
    onSettled: (_grade, _error, { userId: studentId, problemId }) =>
      // One change fewer settling, whichever way it went
      settling.settle(pairKey(studentId, problemId)),
    authReason: t('saveFailed'),
    errorMessage: t('saveFailed'),
  })

  // The grades made final together, which land in the cache before the server answers
  const { mutate: mutateFinal } = useOptimisticMutation<StudentGrade[], FinalWrite, void>({
    apiFn: (apiCall, { problemId, userIds }) => sendFinalizeGrades(apiCall, problemId, userIds),
    // Behind every change made before it, and ahead of every change made after
    scope: GRADE_WRITES_SCOPE,
    onMutate: ({ problemId, userIds }) =>
      // Each grade final, straight away
      userIds.forEach((studentId) => showChange({ userId: studentId, problemId }, MAKE_FINAL)),
    onSuccess: (grades, { problemId, userIds }) =>
      // The server's answer for each, none where it holds no grade
      userIds.forEach((studentId) =>
        landChange(
          { userId: studentId, problemId },
          grades.find((answer) => answer.userId === studentId)?.grade ?? null
        )
      ),
    onError: (_error, { problemId, userIds }) =>
      // What the server still holds for each
      userIds.forEach((studentId) => refuseChange({ userId: studentId, problemId })),
    onSettled: (_grades, _error, { problemId, userIds }) =>
      // One change fewer settling on each, whichever way it went
      userIds.forEach((studentId) => settling.settle(pairKey(studentId, problemId))),
    authReason: t('saveFailed'),
    errorMessage: t('finalizeFailed'),
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

  // Makes several grades on one problem final together
  const finalizeGrades = useCallback(
    (problemId: string, userIds: string[]) => mutateFinal({ problemId, userIds }),
    [mutateFinal]
  )

  // The ways to change grades
  return { changeGrade, finalizeGrades }
}
