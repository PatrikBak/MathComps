import { assertNever } from '@/components/shared/utils/assert-never'

import type { PoolViewMode } from './selection-routes'
import type { Board, ProposalArea, SelectionCategory } from './selection-types'

/** Every answer to whether the board on screen holds a problem. */
const BOARD_MEMBERSHIPS = ['selected', 'notSelected'] as const

/** Whether the board on screen holds a problem. */
export type BoardMembership = (typeof BOARD_MEMBERSHIPS)[number]

/**
 * Every answer the pool's State facet can give: whether the board on screen holds a problem, or that a thread is about
 * a whole paper.
 */
export const POOL_STANDINGS = [...BOARD_MEMBERSHIPS, 'wholePaper'] as const

/**
 * Where something the pool lists stands: a problem the board on screen holds or doesn't, or a thread about a whole
 * paper.
 */
export type PoolStanding = (typeof POOL_STANDINGS)[number]

/**
 * Whether a State answer follows the board on screen, so that another board on screen changes what it lets through.
 *
 * @param standing - The answer; null for none.
 *
 * @returns True for an answer on or off the board.
 */
export function followsBoard(standing: PoolStanding | null): standing is BoardMembership {
  // By the answer
  switch (standing) {
    case 'selected':
    case 'notSelected':
      return true
    case 'wholePaper':
    case null:
      return false

    // Every answer is handled above
    default:
      return assertNever(standing)
  }
}

/**
 * The answers each layout of the pool offers on its State facet, in the order the facet lists them, a whole paper only
 * where its threads are listed.
 */
export const OFFERED_STANDINGS: Record<PoolViewMode, readonly PoolStanding[]> = {
  problems: BOARD_MEMBERSHIPS,
  ratings: BOARD_MEMBERSHIPS,
  comments: POOL_STANDINGS,
}

/**
 * What the pool is narrowed to.
 */
export type PoolFilter = {
  /** Text a problem or a thread must contain, or a number like #7 naming one problem. */
  query: string
  /** The categories, by name, a problem or a thread must count toward at least one of; empty for any. */
  categories: string[]
  /** The areas a problem, or a thread's problem, must belong to one of; empty for any. */
  areas: ProposalArea[]
  /** Where what the pool lists must stand; null for anywhere. */
  standing: PoolStanding | null
  /** Whether the pool shows the set-aside problems instead of the live ones. */
  isShowingSetAside: boolean
}

/** A filter narrowing the pool by nothing. */
export const OPEN_POOL_FILTER: PoolFilter = {
  query: '',
  categories: [],
  areas: [],
  standing: null,
  isShowingSetAside: false,
}

/**
 * A filter narrowed to the categories the selection lists, in the order they run.
 *
 * @param filter - What the pool is narrowed to.
 * @param categories - The selection's categories, in the order they run.
 *
 * @returns The filter without the categories the selection doesn't list.
 */
export function withListedCategories(
  filter: PoolFilter,
  categories: readonly SelectionCategory[]
): PoolFilter {
  // The filter, holding each of the selection's categories it picked
  return {
    ...filter,
    categories: categories
      .map((category) => category.name)
      .filter((name) => filter.categories.includes(name)),
  }
}

/**
 * A filter as a layout of the pool reads it: a State answer the layout doesn't offer narrows nothing there, and is
 * still picked in a layout that offers it.
 *
 * @param filter - What the pool is narrowed to.
 * @param mode - The layout.
 *
 * @returns The filter the layout narrows by.
 */
export function filterForView(filter: PoolFilter, mode: PoolViewMode): PoolFilter {
  // The filter, its State answer dropped where the layout doesn't offer it
  return filter.standing === null || OFFERED_STANDINGS[mode].includes(filter.standing)
    ? filter
    : { ...filter, standing: null }
}

/**
 * The key a filter goes by against a board, alike for two searches differing only in the spaces around them.
 *
 * @param filter - What the pool is narrowed to.
 * @param board - The board the filter is read against; null for none.
 *
 * @returns The key.
 */
export function poolFilterKey(filter: PoolFilter, board: Board | null): string {
  // The filter with its search as the pool reads it, and the board
  return JSON.stringify([{ ...filter, query: filter.query.trim() }, board?.id ?? null])
}

/**
 * How many of a filter's fields narrow anything.
 *
 * @param filter - What the pool is narrowed to.
 *
 * @returns The count, the search among them once it holds more than spaces.
 */
export function countActiveFilters(filter: PoolFilter): number {
  // How many of the fields narrow the pool
  return [
    filter.query.trim() !== '',
    filter.categories.length > 0,
    filter.areas.length > 0,
    filter.standing !== null,
    filter.isShowingSetAside,
  ].filter(Boolean).length
}

/**
 * Whether a filter narrows by a search or a facet, in the set-aside view and the live one alike.
 *
 * @param filter - What the pool is narrowed to.
 *
 * @returns True where anything but the choice of the set-aside view narrows it.
 */
export function isNarrowed(filter: PoolFilter): boolean {
  // Any field narrowing the pool, the set-aside view left out
  return countActiveFilters({ ...filter, isShowingSetAside: false }) > 0
}
