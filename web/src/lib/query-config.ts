import { type DefaultOptions, QueryClient } from '@tanstack/react-query'

import { BackendApiError } from '@/lib/api/api-error'

/** Milliseconds in a second; the base unit for every duration below. */
const SECOND = 1000
/** Milliseconds in a minute. */
const MINUTE = 60 * SECOND

/** Starting delay the exponential backoff doubles from. */
const RETRY_BASE_MS = 500
/** Ceiling the exponential backoff is capped at. */
const RETRY_MAX_MS = 10 * SECOND
/** How many times a transient failure is retried before the query settles into its error state. */
const MAX_RETRIES = 3

/**
 * The shared retry policy: a permanent client failure (an HTTP 4xx) never heals on a retry, so stop and
 * surface the error immediately; anything else (5xx, a network drop, an unclassified fault) is treated
 * as transient and retried up to {@link MAX_RETRIES} times before the query settles into its error state.
 *
 * @param failureCount - How many times the query function has failed so far.
 * @param error - The value the query function threw.
 *
 * @returns Whether React Query should retry.
 */
function shouldRetry(failureCount: number, error: unknown): boolean {
  // A 4xx is a permanent business failure: retrying it just spins
  const status = error instanceof BackendApiError ? error.statusCode : undefined
  if (status !== undefined && status >= 400 && status < 500) {
    return false
  }

  // Otherwise a transient fault: retry a bounded number of times, then let the error surface
  return failureCount < MAX_RETRIES
}

/**
 * Cache-freshness tiers keyed by how the underlying data changes. Spread the matching tier into a
 * query's options (`useQuery({ ..., ...cachePolicy.userData })`); near-static queries inherit the
 * {@link cachePolicy.content} baseline from {@link defaultQueryOptions} and name no tier. Each tier's
 * doc is the canonical home for why its timings are what they are.
 */
export const cachePolicy = {
  /** Near-static content (problems, contests, filter options); admin edits only. Also the global baseline. */
  content: { staleTime: 10 * MINUTE, gcTime: 30 * MINUTE },
  /** User- or peer-driven data that should reflect recent activity quickly (comment threads, the user's own lists). */
  userData: { staleTime: 30 * SECOND, gcTime: 10 * MINUTE },
  /** Aggregate counts that can lag slightly without hurting the reader (comment counts). */
  counts: { staleTime: 60 * SECOND, gcTime: 10 * MINUTE },
} as const

/**
 * The {@link DefaultOptions} for the app's {@link QueryClient}: the near-static freshness
 * baseline plus cross-cutting fetch behavior.
 *
 * Queries retry only transient failures ({@link shouldRetry}) so a permanent 4xx surfaces its error
 * state immediately; the backoff doubles from {@link RETRY_BASE_MS}, capped at {@link RETRY_MAX_MS}.
 */
const defaultQueryOptions = {
  queries: {
    // Most data here is near-static, so default to the content tier.
    ...cachePolicy.content,
    // Retry transient faults a bounded number of times; never retry a permanent 4xx.
    retry: shouldRetry,
    // Exponential backoff, capped at the ceiling.
    retryDelay: (attemptIndex: number) => Math.min(RETRY_BASE_MS * 2 ** attemptIndex, RETRY_MAX_MS),
    // No refetch on window focus (opt in per query if a view needs it).
    refetchOnWindowFocus: false,
    // Likewise, no refetch when the network reconnects.
    refetchOnReconnect: false,
  },
} satisfies DefaultOptions

/** Builds the app's single {@link QueryClient} from the shared {@link defaultQueryOptions}. */
export function createQueryClient(): QueryClient {
  // One client for the whole app, wired to the shared defaults.
  return new QueryClient({ defaultOptions: defaultQueryOptions })
}
