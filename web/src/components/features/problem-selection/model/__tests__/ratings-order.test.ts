import { describe, expect, it } from 'vitest'

import { DEFAULT_RATINGS_SORT, sortByRatings } from '../ratings-order'
import type { Proposal, ProposalRating } from '../selection-types'

/**
 * One reviewer's rating.
 *
 * @param rater - The reviewer's username, doubling as their id.
 * @param beauty - The beauty given; null for none.
 * @param difficulty - The difficulty given; null for none.
 *
 * @returns The rating, from a reviewer who is not the reader.
 */
function rating(rater: string, beauty: number | null, difficulty: number | null): ProposalRating {
  // A rating from somebody else
  return { rater: { id: rater, username: rater, email: null }, isOwn: false, beauty, difficulty }
}

/**
 * A problem with the given number and ratings, and nothing else of note.
 *
 * @param number - The number it is quoted by.
 * @param ratings - Its ratings.
 *
 * @returns The problem.
 */
function proposal(number: number, ratings: ProposalRating[]): Proposal {
  // The problem, its id its number
  return {
    id: String(number),
    number,
    title: `Problem ${number}`,
    area: 'algebra',
    recommended: [],
    texts: {},
    originalLanguage: null,
    isSetAside: false,
    isUsed: false,
    ratings,
  }
}

/**
 * The pool used by every case, in the order it runs, which is out of number order: beauties of 3, 5, 4.5 and 3, a
 * problem scored on difficulty alone, and one nobody rated.
 */
const POOL = [
  proposal(6, [rating('Ann', 3, 4)]),
  proposal(1, []),
  proposal(4, [rating('Ann', 5, null)]),
  proposal(2, [rating('Ann', 4, 1), rating('Ben', 5, null)]),
  proposal(5, [rating('Ann', null, 5)]),
  proposal(3, [rating('Ann', 3, null)]),
]

describe('sortByRatings', () => {
  it('opens in the order the problems run, and turns it round by place', () => {
    // The order the table opens in
    const opening = sortByRatings(POOL, DEFAULT_RATINGS_SORT)

    // By place from the last
    const reversed = sortByRatings(POOL, { by: 'place', ascending: false })

    // The pool's own order
    expect(opening.map((candidate) => candidate.number)).toEqual([6, 1, 4, 2, 5, 3])

    // The same turned round
    expect(reversed.map((candidate) => candidate.number)).toEqual([3, 5, 2, 4, 1, 6])
  })

  it('puts the best average first, level ones in the order they run, and the problems nobody scored on the aspect last', () => {
    // Beauty from the highest
    const order = sortByRatings(POOL, { by: 'beauty', ascending: false })

    // 5, 4.5, the two 3s as they run, then the unscored ones as they run: the one nobody rated, then the one scored on
    // difficulty alone
    expect(order.map((candidate) => candidate.number)).toEqual([4, 2, 6, 3, 1, 5])
  })

  it('keeps the problems nobody scored on the aspect last when turned round', () => {
    // Beauty from the lowest
    const order = sortByRatings(POOL, { by: 'beauty', ascending: true })

    // The two 3s as they run, 4.5, 5, and the unscored ones still last
    expect(order.map((candidate) => candidate.number)).toEqual([6, 3, 2, 4, 1, 5])
  })

  it('ties two averages of different tenths that come to the same score, keeping the order they run', () => {
    // Both average 1.2, though 1.1 and 1.3 added as they stand come to a hair more than 1 and 1.4
    const tied = [
      proposal(8, [rating('Ann', 1.1, null), rating('Ben', 1.3, null)]),
      proposal(7, [rating('Ann', 1, null), rating('Ben', 1.4, null)]),
    ]

    // Beauty from the highest
    const order = sortByRatings(tied, { by: 'beauty', ascending: false })

    // As they run, as a tie
    expect(order.map((candidate) => candidate.number)).toEqual([8, 7])
  })
})
