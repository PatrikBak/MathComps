import { assertNever } from '@/components/shared/utils/assert-never'
import type { TableSort } from '@/components/shared/utils/table-sort'

import { averageScore } from './selection-state'
import type { Proposal, RatingAspect } from './selection-types'

/**
 * A column the ratings table orders its problems by: their place in the order they run, or one aspect's average.
 */
export type RatingsColumn = 'place' | RatingAspect

/** Which way each column reads when it is first pressed: places from the first, averages from the highest. */
export const RATINGS_STARTS_ASCENDING: Record<RatingsColumn, boolean> = {
  place: true,
  beauty: false,
  difficulty: false,
}

/** The order the ratings table opens in: the order its problems run. */
export const DEFAULT_RATINGS_SORT: TableSort<RatingsColumn> = { by: 'place', ascending: true }

/**
 * Orders problems for the ratings table. By place, the problems keep the order they come in, or turn it round. By an
 * aspect, the problems nobody scored on it stay last either way round, and two problems whose averages are level keep
 * the order they come in.
 *
 * @param proposals - The problems, in the order they run.
 * @param sort - The order asked for.
 *
 * @returns The problems in that order.
 */
export function sortByRatings(
  proposals: readonly Proposal[],
  sort: TableSort<RatingsColumn>
): Proposal[] {
  // Which column decides
  switch (sort.by) {
    // By place: the order they come in, or the same turned round
    case 'place':
      return sort.ascending ? [...proposals] : proposals.toReversed()

    // By an aspect's average, the sort being stable, so level problems keep the order they come in
    case 'beauty':
    case 'difficulty': {
      // The aspect whose averages decide
      const aspect = sort.by

      // Which way round the column reads
      const direction = sort.ascending ? 1 : -1

      // The problems by the aspect's average
      return proposals.toSorted((first, second) =>
        compareAverages(
          averageScore(first.ratings, aspect),
          averageScore(second.ratings, aspect),
          direction
        )
      )
    }

    // Every column is handled above
    default:
      return assertNever(sort.by)
  }
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
