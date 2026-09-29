import {
  HOSTED_COMPETITION_CATEGORIES,
  type HostedCompetitionCategory,
} from '@/components/features/hosted-competitions/model/hosted-competition-types'

import type { PairIds } from '../../grades/model/grade-types'

/** The query parameter naming the category on screen. */
const CATEGORY_PARAM = 'category'

/** The query parameter naming the entrant whose grade is open. */
const STUDENT_PARAM = 'student'

/** The query parameter naming the problem whose grade is open. */
const PROBLEM_PARAM = 'problem'

/**
 * What the grading board is showing, as the address bar carries it.
 */
export type GradingUrlState = {
  /** The category picked; null while none is, which shows the first. */
  category: HostedCompetitionCategory | null
  /** The grade open; null while none is. */
  open: PairIds | null
}

/**
 * Writes what the board is showing into query parameters, so a reload comes back to it and the address can be
 * handed to somebody else.
 *
 * @param state - What the board is showing.
 * @returns The query string, without its leading question mark; empty when nothing is worth carrying.
 */
export function toGradingQuery(state: GradingUrlState): string {
  // What the address will carry, always written in the same order, so the same board makes the same address
  const params = new URLSearchParams()

  // The category picked, by the name it goes by on the wire, which reads the same in every language
  if (state.category !== null) params.set(CATEGORY_PARAM, state.category)

  // The open grade, where one is
  if (state.open !== null) {
    // Named by the entrant and the problem
    params.set(STUDENT_PARAM, state.open.userId)
    params.set(PROBLEM_PARAM, state.open.problemId)
  }

  // The address's query, ready to hang off the board's path
  return params.toString()
}

/**
 * Reads back what {@link toGradingQuery} wrote. Anything the address carries that isn't one of ours, or isn't
 * shaped like the field it names, is left out rather than trusted: a query string is somebody's typing.
 *
 * Whether the ids name anybody on the board is not for the address to say. The board only has that once it has
 * arrived, and it is what decides whether the grade opens.
 *
 * @param params - The address's query parameters.
 * @returns What the board should show.
 */
export function fromGradingQuery(params: URLSearchParams): GradingUrlState {
  // What the address names the category as
  const categoryParam = params.get(CATEGORY_PARAM)

  // The category, where the address names one there is
  const category =
    HOSTED_COMPETITION_CATEGORIES.find((candidate) => candidate === categoryParam) ?? null

  // Who and what the open grade is about
  const userId = params.get(STUDENT_PARAM)
  const problemId = params.get(PROBLEM_PARAM)

  // A grade takes both to name, so half of one names none
  if (userId === null || userId === '' || problemId === null || problemId === '') {
    return { category, open: null }
  }

  // The grade
  return { category, open: { userId, problemId } }
}
