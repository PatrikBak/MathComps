import { type DefaultOptions, type Query, QueryClient } from '@tanstack/react-query'

import { isTransientFailure } from '@/lib/api/api-error'

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
 * The shared retry policy: a permanent client failure never heals on a retry, so stop and surface the
 * error immediately; a transient one is retried up to {@link MAX_RETRIES} times before the query
 * settles into its error state.
 *
 * @param failureCount - How many times the query function has failed so far.
 * @param error - The value the query function threw.
 *
 * @returns Whether React Query should retry.
 */
function shouldRetry(failureCount: number, error: unknown): boolean {
  // Retrying a permanently failed request just spins
  if (!isTransientFailure(error)) {
    return false
  }

  // Otherwise retry a bounded number of times, then let the error surface
  return failureCount < MAX_RETRIES
}

/**
 * Whether a query has given up on a failure that another attempt could still fix.
 *
 * This is the population the recovery refetches below wake up. Scoping them this narrowly is what
 * lets a dead page heal without reintroducing background refetches for healthy queries.
 *
 * @param query - The query React Query is deciding about.
 *
 * @returns Whether the query is worth waking up.
 */
function isWorthWakingUp(query: Query): boolean {
  // Only a settled failure needs recovering, and only one that could plausibly succeed next time
  return query.state.status === 'error' && isTransientFailure(query.state.error)
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
 * Queries retry only transient failures ({@link shouldRetry}) so a permanent failure surfaces its error
 * state immediately; the backoff doubles from {@link RETRY_BASE_MS}, capped at {@link RETRY_MAX_MS}.
 *
 * That burst is spent within seconds, so returning to the tab or regaining the connection is what
 * revives a query that gave up ({@link isWorthWakingUp}). Recovery is event-driven because the search
 * endpoints are rate-limited tightly enough that a timer would lock the user out of the feature it
 * was meant to fix.
 */
const defaultQueryOptions = {
  queries: {
    // Most data here is near-static, so default to the content tier.
    ...cachePolicy.content,
    // Retry transient faults a bounded number of times; never retry a permanent failure.
    retry: shouldRetry,
    // Exponential backoff, capped at the ceiling.
    retryDelay: (attemptIndex: number) => Math.min(RETRY_BASE_MS * 2 ** attemptIndex, RETRY_MAX_MS),
    // Returning to the tab retries a query that gave up, and nothing else.
    refetchOnWindowFocus: isWorthWakingUp,
    // Likewise for regaining the connection.
    refetchOnReconnect: isWorthWakingUp,
  },
} satisfies DefaultOptions

/** Builds the app's single {@link QueryClient} from the shared {@link defaultQueryOptions}. */
export function createQueryClient(): QueryClient {
  // One client for the whole app, wired to the shared defaults.
  return new QueryClient({ defaultOptions: defaultQueryOptions })
}
