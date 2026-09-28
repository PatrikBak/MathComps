import {
  HOSTED_COMPETITION_CATEGORIES,
  type HostedCompetitionCategory,
} from '@/components/features/hosted-competitions/model/hosted-competition-types'

import type { PairIds } from './grading-types'

/** The query parameter naming the category on screen. */
const CATEGORY_PARAM = 'category'

/** The query parameter naming the entrant whose grade is open. */
const STUDENT_PARAM = 'student'

/** The query parameter naming the problem whose grade is open. */
const PROBLEM_PARAM = 'problem'

/** The query parameter naming which of the open grade's conversations is showing, counting from one. */
const CONVERSATION_PARAM = 'conversation'

/**
 * How a conversation's number is spelled in the address: a plain run of digits. Number reads far more than
 * that, taking `0x2` for the second and `2.0` and a padded ` 2 ` for numbers nobody typed.
 */
const CONVERSATION_PATTERN = /^\d+$/

/**
 * The grade open on the board, and which of its conversations is showing.
 */
type OpenGrade = PairIds & {
  /** Which conversation is showing, counting from one. */
  conversation: number
}

/**
 * What the grading board is showing, as the address bar carries it.
 */
export type GradingUrlState = {
  /** The category picked; null while none is, which shows the first. */
  category: HostedCompetitionCategory | null
  /** The grade open; null while none is. */
  open: OpenGrade | null
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

    // And by the conversation showing, which the first needs no word about, being where every grade opens
    if (state.open.conversation > 1) params.set(CONVERSATION_PARAM, String(state.open.conversation))
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

  // The grade, on whichever conversation the address names
  return { category, open: { userId, problemId, conversation: readConversation(params) } }
}

/**
 * Reads which conversation of the open grade the address names.
 *
 * @param params - The address's query parameters.
 * @returns The conversation's number, counting from one; the first where the address names none a count can be.
 */
function readConversation(params: URLSearchParams): number {
  // What the address says, as it was written down
  const conversationParam = params.get(CONVERSATION_PARAM)

  // Read only when it is spelled the way a number is, so nothing else reaches the count
  const conversation =
    conversationParam !== null && CONVERSATION_PATTERN.test(conversationParam)
      ? Number(conversationParam)
      : null

  // A count starts at one, and one too long to hold exactly is somebody's typing rather than a conversation
  return conversation !== null && conversation >= 1 && Number.isSafeInteger(conversation)
    ? conversation
    : 1
}
