import {
  type DefaultOptions,
  focusManager,
  hashKey,
  type MutationFilters,
  type Query,
  QueryClient,
  type QueryKey,
  type QueryState,
} from '@tanstack/react-query'

import { MINUTE_MS, SECOND_MS } from '@/components/shared/utils/time-units'
import { isTransientFailure } from '@/lib/api/api-error'

/** Starting delay the exponential backoff doubles from. */
const RETRY_BASE_MS = 500
/** Ceiling the exponential backoff is capped at. */
const RETRY_MAX_MS = 10 * SECOND_MS
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
 * lets a dead page heal without waking a healthy query.
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
 * Whether a query has settled on a failure that another attempt can only repeat.
 *
 * @param state - Where the query stands.
 *
 * @returns Whether the query has failed for good.
 */
function hasFailedForGood(state: QueryState): boolean {
  // A settled failure, and one no repeat of the request could change
  return state.status === 'error' && !isTransientFailure(state.error)
}

/** How often a {@link cachePolicy.live} read on screen is made again. */
const LIVE_REFRESH_MS = 30 * SECOND_MS

/** A read's query, as much of it as a tier decides on. */
type TieredQuery = Pick<Query, 'state'>

/**
 * Whether a read is worth making again on its own: anything short of a failure no repeat could change.
 *
 * @param query - The read to decide about.
 *
 * @returns Whether to make it again.
 */
function isWorthRefreshing(query: TieredQuery): boolean {
  // Everything but a settled failure another attempt can only repeat
  return !hasFailedForGood(query.state)
}

/**
 * A cache-freshness tier: how long an answer counts as fresh, how long one nobody reads is kept, and what
 * reads it again on its own.
 */
export type CachePolicyTier = {
  /** How long an answer counts as fresh. */
  staleTime: number
  /** How long an answer nobody is reading is kept. */
  gcTime: number
  /** How often a read on screen is made again, for a tier that reads on a timer. */
  refetchInterval?: (query: TieredQuery) => number | false
  /** Whether coming back to the tab reads the answer again once it has gone stale. */
  refetchOnWindowFocus?: (query: TieredQuery) => boolean
  /** Whether regaining the connection reads the answer again once it has gone stale. */
  refetchOnReconnect?: (query: TieredQuery) => boolean
}

/**
 * Cache-freshness tiers keyed by who changes the underlying data, one named by every read. Each tier's doc is
 * the canonical home for why its timings are what they are.
 */
export const cachePolicy = {
  /**
   * Near-static content that only an import or an admin edit moves (problems, competitions, filter options).
   * Also the global baseline.
   */
  content: { staleTime: 10 * MINUTE_MS, gcTime: 30 * MINUTE_MS },
  /**
   * Data read again only when something asks: a write invalidating it, a reader opening it once it has gone
   * stale, a refresh pressed. For the reader's own data, which their writes keep current, and for a read that
   * must hold still under its reader.
   */
  onDemand: { staleTime: 30 * SECOND_MS, gcTime: 10 * MINUTE_MS },
  /**
   * Data other people change (comment threads and counts, grades, a competition while it runs), read again
   * while it is on screen: on a timer, on coming back to the tab and on regaining the connection. A tab in the
   * background skips the timer.
   */
  live: {
    staleTime: LIVE_REFRESH_MS,
    gcTime: 10 * MINUTE_MS,
    refetchInterval: (query) => (isWorthRefreshing(query) ? LIVE_REFRESH_MS : false),
    refetchOnWindowFocus: isWorthRefreshing,
    refetchOnReconnect: isWorthRefreshing,
  },
} as const satisfies Record<string, CachePolicyTier>

/**
 * Drops every read still out for answers already cached, so one that left before a write cannot land over
 * what the write puts in the cache. A read with nothing cached yet is left to finish, since nothing would
 * replace it.
 *
 * @param queryClient - The cache.
 * @param queryKey - What the answers are cached under, as a prefix.
 */
export function dropReadsInFlight(queryClient: QueryClient, queryKey: QueryKey): void {
  // Every read out for an answer already there. Dropping takes effect at once, so whatever the caller writes
  // next is the last word
  void queryClient.cancelQueries({ queryKey, predicate: (query) => query.state.data !== undefined })
}

/**
 * Calls back once the page is on screen, as React Query tells it for its own reads: at once where it already is,
 * otherwise as the reader brings it up, as after opening a link in a browser tab of its own behind the one they read.
 * The page is asked as it stands, so a wait set off from an effect neither waits for a render nor restarts with one.
 *
 * @param onShown - Called once, as the page shows.
 *
 * @returns A function which stops the wait.
 */
export function oncePageShows(onShown: () => void): () => void {
  // On screen already
  if (focusManager.isFocused()) {
    // Called back at once
    onShown()

    // Nothing left to stop
    return () => {}
  }

  // The page's coming on screen listened for, until it comes
  const stop = focusManager.subscribe((isFocused) => {
    // Still out of sight
    if (!isFocused) return

    // Listened for no longer
    stop()

    // Called back
    onShown()
  })

  // The way to stop the wait
  return stop
}

/**
 * Calls back once a read's answer lands in one cached query, an answer written straight into the cache aside. It
 * watches the cache, since a refetch's own promise also resolves when its read is dropped, as happens when the query's
 * last reader leaves.
 *
 * Where the cache holds the query, it sets a read off, joining one already out. It sets none off after a failure no
 * repeat could change, nor while a write that could have the read land over its edit is out. A read that is dropped,
 * fails or waits for the connection is waited past, until an answer lands.
 *
 * @param queryClient - The cache.
 * @param queryKey - Exactly what the answer is cached under.
 * @param heldBy - The writes that hold the read back while they are out.
 * @param onLanded - Called once, as the answer lands.
 *
 * @returns A function which stops the wait.
 */
export function onceAnswerLands(
  queryClient: QueryClient,
  queryKey: QueryKey,
  heldBy: MutationFilters,
  onLanded: () => void
): () => void {
  // How the cache tells the query apart
  const queryHash = hashKey(queryKey)

  // Every change in the cache watched, until a read's answer lands in the query
  const stop = queryClient.getQueryCache().subscribe((event) => {
    // Anything but a read's answer landing in the query
    if (
      event.type !== 'updated' ||
      event.query.queryHash !== queryHash ||
      event.action.type !== 'success' ||
      event.action.manual === true
    ) {
      return
    }

    // Watched no longer
    stop()

    // Called back
    onLanded()
  })

  // The query as the cache holds it, absent while the cache knows none
  const query = queryClient.getQueryCache().find({ queryKey, exact: true })

  // A read set off, joining one already out, where one is worth making and no write holds it back
  if (query !== undefined && isWorthRefreshing(query) && queryClient.isMutating(heldBy) === 0) {
    void queryClient.refetchQueries({ queryKey, exact: true }, { cancelRefetch: false })
  }

  // The way to stop the wait
  return stop
}

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
