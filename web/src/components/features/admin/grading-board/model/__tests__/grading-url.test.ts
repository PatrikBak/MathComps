import { describe, expect, it } from 'vitest'

import {
  fromGradingQuery,
  type GradingLanding,
  type GradingUrlState,
  toGradingQuery,
} from '../grading-url'

/** The student whose grade the tests open. */
const STUDENT = '3f2a1b4c-5d6e-4f70-8a91-b2c3d4e5f607'

/** The problem whose grade the tests open. */
const PROBLEM = '0199a1b2-c3d4-7e5f-8a6b-7c8d9e0f1a2b'

/**
 * Reads a query string the way the board does.
 *
 * @param query - The query string, without its leading question mark.
 * @returns What the board should show.
 */
function read(query: string): GradingLanding {
  // What the board would show on landing there
  return fromGradingQuery(new URLSearchParams(query))
}

describe('toGradingQuery', () => {
  it('carries nothing while nothing is picked and nothing is open', () => {
    // The board as it first opens
    const query = toGradingQuery({ category: null, open: null })

    // A bare path, so the board's own address carries no query at all
    expect(query).toBe('')
  })

  it('names the category, the student and the problem, in the order a person reads them', () => {
    // A grade open on the intermediate board
    const query = toGradingQuery({
      category: 'intermediate',
      open: { userId: STUDENT, problemId: PROBLEM },
    })

    // Each in its place
    expect(query).toBe(`category=intermediate&student=${STUDENT}&problem=${PROBLEM}`)
  })
})

describe('fromGradingQuery', () => {
  it('reads back everything the board wrote', () => {
    // A board narrowed every way the address can carry
    const state: GradingUrlState = {
      category: 'advanced',
      open: { userId: STUDENT, problemId: PROBLEM },
    }

    // Which comes back as it went out, landing on no part of the grade
    expect(read(toGradingQuery(state))).toEqual({ ...state, tab: null })
  })

  it('reads each category by the name it goes by on the wire', () => {
    // Every category the address can name
    const categories = ['elementary', 'intermediate', 'advanced'] as const

    // Each comes back as itself
    categories.forEach((category) => expect(read(`category=${category}`).category).toBe(category))
  })

  it('drops a category that is none, and keeps the grade it came with', () => {
    // A category spelled the way the page names it rather than the way the address does
    const state = read(`category=Stredn%C3%A1&student=${STUDENT}&problem=${PROBLEM}`)

    // No category, which shows the first
    expect(state.category).toBeNull()

    // The grade still open
    expect(state.open).toEqual({ userId: STUDENT, problemId: PROBLEM })
  })

  it.each([
    ['a student alone', `student=${STUDENT}`],
    ['a problem alone', `problem=${PROBLEM}`],
    ['an empty student', `student=&problem=${PROBLEM}`],
    ['an empty problem', `student=${STUDENT}&problem=`],
  ])('opens nothing for %s', (_description, query) => {
    // Half a grade names none
    expect(read(`category=elementary&${query}`)).toEqual({
      category: 'elementary',
      open: null,
      tab: null,
    })
  })

  it('lands the grade a link names on the conversation with the student', () => {
    // A link straight into the thread about the student's grade
    const landing = read(`student=${STUDENT}&problem=${PROBLEM}&tab=feedback`)

    // The grade, landing on that thread
    expect(landing).toEqual({
      category: null,
      open: { userId: STUDENT, problemId: PROBLEM },
      tab: 'feedback',
    })
  })

  it.each([
    ['a part no link lands on', `student=${STUDENT}&problem=${PROBLEM}&tab=notes`],
    ['no grade to land in', 'tab=feedback'],
  ])('lands on no part for %s', (_description, query) => {
    // Wherever the grade starts
    expect(read(query).tab).toBeNull()
  })
})
