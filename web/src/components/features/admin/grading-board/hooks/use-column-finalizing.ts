import { useState } from 'react'

import { useFocusReturn } from '@/hooks/use-focus-return'

import { useUpdateGrade } from '../../grades/hooks/use-update-grade'
import type { ColumnReady } from '../model/grading-board'
import type { GradingProblem } from '../model/grading-types'

/**
 * A problem's column the grader has asked to make final.
 */
export type ColumnToFinalize = {
  /** The problem. */
  problem: GradingProblem
  /** The marks in its column to make final. */
  column: ColumnReady
}

/**
 * What {@link useColumnFinalizing} hands back.
 */
type UseColumnFinalizingResult = {
  /** The column waiting on the grader's confirmation; null while none is. */
  asking: ColumnToFinalize | null
  /** Asks the grader to confirm making a column final. */
  ask: (column: ColumnToFinalize) => void
  /** Drops the question, making nothing final. */
  dismiss: () => void
  /** Makes the column asked about final. */
  confirm: () => void
}

/**
 * Making a problem's whole column final, once the grader has confirmed it.
 *
 * @returns The question and its answers, as described by {@link UseColumnFinalizingResult}.
 */
export function useColumnFinalizing(): UseColumnFinalizingResult {
  // The way to make grades final
  const { finalizeGrades } = useUpdateGrade()

  // The column waiting on the grader's confirmation
  const [asking, setAsking] = useState<ColumnToFinalize | null>(null)

  // A function which puts focus back on the column last asked about
  const returnFocus = useFocusReturn(asking?.problem.id ?? null)

  // A function which drops the question
  const dismiss = () => setAsking(null)

  // A function which makes the column asked about final
  const confirm = () => {
    // Nothing asked, nothing to make final
    if (asking === null) return

    // Every mark in the column the grader confirmed
    finalizeGrades(asking.problem.id, asking.column.userIds)

    // Focus back on the column, whose button is gone by the time the dialog hands focus back
    requestAnimationFrame(returnFocus)
  }

  // The question and its answers
  return { asking, ask: setAsking, dismiss, confirm }
}
