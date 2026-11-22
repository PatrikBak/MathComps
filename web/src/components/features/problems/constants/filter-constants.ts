import type { LogicToggle } from '../types/problem-api-types'

/**
 * Chip display constants for filter chips and UI elements.
 */
export const CHIP_CONSTANTS = {
  /** Maximum number of chips to show before collapsing the group */
  collapseThreshold: 5,
} as const

/**
 * The other way of combining a filter's values, for each way.
 */
export const OPPOSITE_LOGIC: Record<LogicToggle, LogicToggle> = {
  and: 'or',
  or: 'and',
}

/**
 * Active filter bar display constants.
 */
export const ACTIVE_FILTERS_CONSTANTS = {
  /**
   * Maximum number of filters that can be selected simultaneously.
   * This limit prevents excessive URL length and maintains reasonable performance.
   */
  maxFilterLimit: 20,
  /** The most chips the bar opens its rows for on its own, while the sidebar shows. */
  maxFiltersForAutoExpand: 8,
} as const
