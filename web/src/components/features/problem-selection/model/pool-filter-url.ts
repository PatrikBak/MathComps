import {
  type BoardMembership,
  followsBoard,
  type PoolFilter,
  type PoolStanding,
} from './pool-filters'
import { PROPOSAL_AREAS } from './selection-types'

/** The query parameter carrying the search text. */
const QUERY_PARAM = 'q'

/** The query parameter naming a category a problem must be recommended for, by its name, once per category. */
const CATEGORY_PARAM = 'category'

/** The query parameter naming an area a problem must belong to, once per area. */
const AREA_PARAM = 'area'

/** The query parameter showing the set-aside problems in place of the live ones. */
const SET_ASIDE_PARAM = 'setAside'

/** The query parameter naming the State answer the address carries. */
const STANDING_PARAM = 'state'

/** Every query parameter the pool's filter owns. */
export const POOL_FILTER_PARAMS = [
  QUERY_PARAM,
  CATEGORY_PARAM,
  AREA_PARAM,
  SET_ASIDE_PARAM,
  STANDING_PARAM,
] as const

/** A State answer the address carries: one following no board, as a whole paper does. */
type AddressedStanding = Exclude<PoolStanding, BoardMembership>

/**
 * The State answer of the pool's filter, as far as the address carries it.
 */
type AddressedStandingPick = {
  /**
   * The answer, where it follows no board; null for any other, since the answers on and off the board follow the board
   * on screen, which a link doesn't carry.
   */
  standing: AddressedStanding | null
}

/**
 * What the address carries of the pool's filter: all of it but a State answer on or off the board.
 */
export type AddressedPoolFilter = Omit<PoolFilter, 'standing'> & AddressedStandingPick

/**
 * What the pool is narrowed to as picked, with the State answer on or off the board last picked, which the address
 * never carries.
 */
export type PoolPicks = {
  /** What the pool is narrowed to. */
  filter: PoolFilter
  /**
   * The answer on or off the board the reader picked last, kept through every step in history and every change leaving
   * the State answer as it stands; null once the reader picks a whole paper or no answer.
   */
  boardPick: BoardMembership | null
}

/**
 * Writes the address's part of the pool's filter into query parameters, so a reload comes back to it and the address
 * can be handed to somebody else.
 *
 * @param filter - What the pool is narrowed to.
 *
 * @returns The query string, without its leading question mark; empty when none of the fields it carries narrows
 * anything.
 */
export function toPoolFilterQuery(filter: PoolFilter): string {
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

  // The State answer, where it follows no board
  if (filter.standing !== null && !followsBoard(filter.standing)) {
    params.set(STANDING_PARAM, filter.standing)
  }

  // The address's query
  return params.toString()
}

/**
 * Reads back what {@link toPoolFilterQuery} wrote. An area the facet has no option for is left out rather than
 * trusted, since a query string is somebody's typing. Each category is kept once, as named.
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

  // The filter, the areas among their own options in the order the facet lists them, each category once, and the
  // State answer only where it names a whole paper
  return {
    query: params.get(QUERY_PARAM) ?? '',
    categories: [...new Set(categories)],
    areas: PROPOSAL_AREAS.filter((area) => areas.includes(area)),
    isShowingSetAside: params.get(SET_ASIDE_PARAM) === '1',
    standing: params.get(STANDING_PARAM) === 'wholePaper' ? 'wholePaper' : null,
  }
}

/**
 * The picks a reader's change to the filter leaves: the answer on or off the board it picks, or the one picked last
 * while it leaves the State answer as it stood.
 *
 * @param picks - The picks before the change.
 * @param filter - What the change narrows the pool to.
 *
 * @returns The picks after the change.
 */
export function withPickedFilter(picks: PoolPicks, filter: PoolFilter): PoolPicks {
  // The answer the change picks, where it follows the board
  if (followsBoard(filter.standing)) return { filter, boardPick: filter.standing }

  // The answer picked last kept while the change leaves the State answer alone, let go once it picks another or none
  return { filter, boardPick: filter.standing === picks.filter.standing ? picks.boardPick : null }
}

/**
 * The picks a step through history leaves: what the step's address carries, with the answer on or off the board picked
 * last where the address names no answer, since the address never carries one.
 *
 * @param picks - The picks before the step.
 * @param addressed - What the step's address narrows the pool to.
 *
 * @returns The picks after the step.
 */
export function withAddressed(picks: PoolPicks, addressed: AddressedPoolFilter): PoolPicks {
  // The address's filter, its State answer where it names one, else the answer picked last, which stays picked last
  return {
    filter: { ...addressed, standing: addressed.standing ?? picks.boardPick },
    boardPick: picks.boardPick,
  }
}
