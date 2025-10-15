/**
 * Chip display constants for filter chips and UI elements.
 */
export const CHIP_CONSTANTS = {
  /** Maximum number of chips to show before collapsing the group */
  collapseThreshold: 5,
} as const

/**
 * Active filter bar display constants.
 */
export const ACTIVE_FILTERS_CONSTANTS = {
  /**
   * Maximum number of filters that can be selected simultaneously.
   * This limit prevents excessive URL length and maintains reasonable performance.
   * Counts tags, authors, seasons, problemNumbers, contestSelection, and searchText.
   */
  maxFilterLimit: 20,
  /** Maximum number of active filters before the bar auto-collapses on desktop */
  maxFiltersForAutoExpand: 8,
} as const
