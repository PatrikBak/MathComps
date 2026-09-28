import { describe, expect, it } from 'vitest'

import { fromGradingQuery, type GradingUrlState, toGradingQuery } from '../grading-url'

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
function read(query: string): GradingUrlState {
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
    // A grade open on the intermediate board, on its first conversation
    const query = toGradingQuery({
      category: 'intermediate',
      open: { userId: STUDENT, problemId: PROBLEM, conversation: 1 },
    })

    // The first conversation left unsaid, being where every grade opens
    expect(query).toBe(`category=intermediate&student=${STUDENT}&problem=${PROBLEM}`)
  })

  it('names a later conversation by its number', () => {
    // A grade open on its second conversation, on whichever board comes first
    const query = toGradingQuery({
      category: null,
      open: { userId: STUDENT, problemId: PROBLEM, conversation: 2 },
    })

    // The number as the dialog labels it
    expect(query).toBe(`student=${STUDENT}&problem=${PROBLEM}&conversation=2`)
  })
})

describe('fromGradingQuery', () => {
  it('reads back everything the board wrote', () => {
    // A board narrowed every way the address can carry
    const state: GradingUrlState = {
      category: 'advanced',
      open: { userId: STUDENT, problemId: PROBLEM, conversation: 3 },
    }

    // Which comes back as it went out
    expect(read(toGradingQuery(state))).toEqual(state)
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
    expect(state.open).toEqual({ userId: STUDENT, problemId: PROBLEM, conversation: 1 })
  })

  it.each([
    ['a student alone', `student=${STUDENT}`],
    ['a problem alone', `problem=${PROBLEM}`],
    ['an empty student', `student=&problem=${PROBLEM}`],
    ['an empty problem', `student=${STUDENT}&problem=`],
    ['a conversation alone', 'conversation=2'],
  ])('opens nothing for %s', (_, query) => {
    // Half a grade names none
    expect(read(`category=elementary&${query}`)).toEqual({ category: 'elementary', open: null })
  })

  it.each([
    ['zero', '0'],
    ['a negative number', '-1'],
    ['a hexadecimal number', '0x2'],
    ['a decimal', '2.0'],
    ['padding', '%202%20'],
    ['a word', 'second'],
    ['a count too long to hold exactly', '99999999999999999999'],
  ])('opens the first conversation for %s', (_, conversation) => {
    // The grade, named with a conversation no count reads as
    const state = read(`student=${STUDENT}&problem=${PROBLEM}&conversation=${conversation}`)

    // The first, where every grade opens
    expect(state.open?.conversation).toBe(1)
  })
})
