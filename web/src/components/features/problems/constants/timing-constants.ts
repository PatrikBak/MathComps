/**
 * Cache timing constants for React Query.
 */
export const CACHE_TIMING = {
  /** How long data stays fresh before refetch (ms) */
  staleTime: 10 * 60 * 1000, // 10 minutes
  /** How long to keep unused data in cache (ms) */
  gcTime: 30 * 60 * 1000, // 30 minutes
} as const

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
