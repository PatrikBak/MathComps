import { assertNever } from '@/components/shared/utils/assert-never'
import type { TableSort } from '@/components/shared/utils/table-sort'

import { averageScore } from './selection-state'
import type { Proposal, RatingAspect } from './selection-types'

/** A column the ratings table orders its problems by: the problem's number, or one aspect's average. */
export type RatingsColumn = 'number' | RatingAspect

/** Which way each column reads when it is first pressed: numbers from the lowest, averages from the highest. */
export const RATINGS_STARTS_ASCENDING: Record<RatingsColumn, boolean> = {
  number: true,
  beauty: false,
  difficulty: false,
}

/** The order the ratings table opens in. */
export const DEFAULT_RATINGS_SORT: TableSort<RatingsColumn> = { by: 'number', ascending: true }

/**
 * Orders problems for the ratings table. By an aspect, the problems nobody scored on it stay last either way round,
 * and the lower number goes first where two averages are level.
 *
 * @param proposals - The problems.
 * @param sort - The order asked for.
 *
 * @returns The problems in that order.
 */
export function sortByRatings(
  proposals: readonly Proposal[],
  sort: TableSort<RatingsColumn>
): Proposal[] {
  // Which way round the column reads
  const direction = sort.ascending ? 1 : -1

  // The problems in the order asked for
  return [...proposals].sort((first, second) => {
    // Which column decides
    switch (sort.by) {
      // By number, which every problem has
      case 'number':
        return direction * (first.number - second.number)

      // By an aspect's average, the lower number settling a tie
      case 'beauty':
      case 'difficulty':
        return (
          compareAverages(
            averageScore(first.ratings, sort.by),
            averageScore(second.ratings, sort.by),
            direction
          ) || first.number - second.number
        )

      // Every column is handled above
      default:
        return assertNever(sort.by)
    }
  })
}

/**
 * Compares two averages, the missing ones staying last whichever way round.
 *
 * @param first - One average; null where nobody scored the aspect.
 * @param second - The other average; null where nobody scored the aspect.
 * @param direction - 1 to put the lower average first, -1 to put the higher one first.
 *
 * @returns Negative when the first goes first, positive when the second one does, zero when they are level.
 */
function compareAverages(first: number | null, second: number | null, direction: 1 | -1): number {
  // An average that is missing stays behind every one that is there
  if (first === null || second === null) {
    return (first === null ? 1 : 0) - (second === null ? 1 : 0)
  }

  // The averages themselves, the way round asked for
  return direction * (first - second)
}
