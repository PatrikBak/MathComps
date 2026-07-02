/**
 * Search timing constants.
 */
export const SEARCH_TIMING = {
  /** Throttle delay for search operations to prevent rapid-fire API calls (ms) */
  throttleMs: 150,
  /** Debounce delay for text input to avoid sending requests on every keystroke (ms) */
  textDebounceMs: 300,
  /** Debounce delay for URL updates (ms) */
  urlDebounceMs: 200,
} as const
