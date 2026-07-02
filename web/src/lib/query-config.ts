import { type DefaultOptions, QueryClient } from '@tanstack/react-query'

/** Milliseconds in a second; the base unit for every duration below. */
const SECOND = 1000
/** Milliseconds in a minute. */
const MINUTE = 60 * SECOND

/** Starting delay the exponential backoff doubles from. */
const RETRY_BASE_MS = 500
/** Ceiling the exponential backoff is capped at. */
const RETRY_MAX_MS = 10 * SECOND

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
 * Queries retry infinitely on network/server errors (resilient to transient failures); the backoff
 * doubles from {@link RETRY_BASE_MS}, capped at {@link RETRY_MAX_MS}. A query can still opt out per
 * error, e.g. stopping retries on a permanent 404.
 */
const defaultQueryOptions = {
  queries: {
    // Most data here is near-static, so default to the content tier.
    ...cachePolicy.content,
    // Never give up on transient network/server errors.
    retry: Infinity,
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
