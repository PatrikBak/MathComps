import { describe, expect, it } from 'vitest'

import { sortByRatings } from '../ratings-order'
import type { Proposal, ProposalRating, RatingScore } from '../selection-types'

/**
 * One reviewer's rating.
 *
 * @param rater - The reviewer's username, doubling as their id.
 * @param beauty - The beauty given; null for none.
 * @param difficulty - The difficulty given; null for none.
 *
 * @returns The rating, from a reviewer who is not the reader.
 */
function rating(
  rater: string,
  beauty: RatingScore | null,
  difficulty: RatingScore | null
): ProposalRating {
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
    isSetAside: false,
    isUsed: false,
    ratings,
  }
}

/**
 * The pool used by every case: beauties of 3, 5, 4.5 and 3, a problem scored on difficulty alone, and one nobody
 * rated, out of number order.
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
  it('puts the best average first, the lower number first on a tie, and the problems nobody scored on the aspect last', () => {
    // Beauty from the highest
    const order = sortByRatings(POOL, { by: 'beauty', ascending: false })

    // 5, 4.5, the two 3s by number, then the unscored ones by number: the one nobody rated, then the one scored on
    // difficulty alone
    expect(order.map((candidate) => candidate.number)).toEqual([4, 2, 3, 6, 1, 5])
  })

  it('keeps the problems nobody scored on the aspect last when turned round', () => {
    // Beauty from the lowest
    const order = sortByRatings(POOL, { by: 'beauty', ascending: true })

    // The two 3s by number, 4.5, 5, and the unscored ones still last
    expect(order.map((candidate) => candidate.number)).toEqual([3, 6, 2, 4, 1, 5])
  })
})
