import { HOSTED_COMPETITION_CATEGORIES } from '@/components/features/hosted-competitions/model/hosted-competition-types'

import type { PoolFilter } from './pool-filters'
import { PROPOSAL_AREAS } from './selection-types'

/** The query parameter carrying the search text. */
const QUERY_PARAM = 'q'

/** The query parameter naming a category a problem must be recommended for, once per category. */
const CATEGORY_PARAM = 'category'

/** The query parameter naming an area a problem must belong to, once per area. */
const AREA_PARAM = 'area'

/** The query parameter showing the set-aside problems in place of the live ones. */
const SET_ASIDE_PARAM = 'setAside'

/** Every query parameter the pool's filter owns. */
export const POOL_FILTER_PARAMS = [
  QUERY_PARAM,
  CATEGORY_PARAM,
  AREA_PARAM,
  SET_ASIDE_PARAM,
] as const

/**
 * What the address carries of the pool's filter: all of it but {@link PoolFilter.isOffBoardOnly}, which follows the
 * board on screen and so means nothing in a link.
 */
export type AddressedPoolFilter = Omit<PoolFilter, 'isOffBoardOnly'>

/**
 * Writes the address's part of the pool's filter into query parameters, so a reload comes back to it and the address
 * can be handed to somebody else.
 *
 * @param filter - What the pool is narrowed to, as far as the address carries it.
 *
 * @returns The query string, without its leading question mark; empty when none of the fields it carries narrows
 * anything.
 */
export function toPoolFilterQuery(filter: AddressedPoolFilter): string {
  // What the address will carry, always written in the same order, so the same filter makes the same address
  const params = new URLSearchParams()

  // The search as typed, once it holds more than spaces
  if (filter.query.trim() !== '') params.set(QUERY_PARAM, filter.query)

  // Each category picked, in the order the facet lists them
  filter.categories.forEach((category) => params.append(CATEGORY_PARAM, category))

  // Each area picked, in the order the facet lists them
  filter.areas.forEach((area) => params.append(AREA_PARAM, area))

  // The set-aside problems, when asked
  if (filter.isShowingSetAside) params.set(SET_ASIDE_PARAM, '1')

  // The address's query
  return params.toString()
}

/**
 * Reads back what {@link toPoolFilterQuery} wrote. A value the filter has no option for is left out rather than
 * trusted, since a query string is somebody's typing.
 *
 * @param params - The address's query parameters.
 *
 * @returns What the address narrows the pool to.
 */
export function fromPoolFilterQuery(params: URLSearchParams): AddressedPoolFilter {
  // The categories the address names
  const categories = params.getAll(CATEGORY_PARAM)

  // The areas the address names
  const areas = params.getAll(AREA_PARAM)

  // The filter, each facet's picks among its own options and in the order it lists them
  return {
    query: params.get(QUERY_PARAM) ?? '',
    categories: HOSTED_COMPETITION_CATEGORIES.filter((category) => categories.includes(category)),
    areas: PROPOSAL_AREAS.filter((area) => areas.includes(area)),
    isShowingSetAside: params.get(SET_ASIDE_PARAM) === '1',
  }
}
