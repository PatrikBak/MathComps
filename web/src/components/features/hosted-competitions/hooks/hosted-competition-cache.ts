import type { QueryKey } from '@tanstack/react-query'

/** Root of every query key the competitions surface reads under, so invalidating it reaches them all. */
export const HOSTED_COMPETITIONS_QUERY_KEY = ['competitions'] as const

/**
 * Who a cached competitions answer belongs to.
 *
 * Every answer on this surface is somebody's: which entries are on it, what they still owe, what each row
 * offers. Cached under anything less, signing out and back in as somebody else hands the second reader the
 * first one's history.
 *
 * A mocked student's identity is the scenario that invented them, and an anonymous reader has none.
 */
export type HostedCompetitionsReaderKey = string | null

/**
 * The key the competitions view is cached under.
 *
 * @param readerKey - Who the answer is about.
 *
 * @returns The cache key.
 */
export function hostedCompetitionsViewQueryKey(readerKey: HostedCompetitionsReaderKey): QueryKey {
  // The view, per reader. Nothing in it is worded, so two languages read one answer
  return [...HOSTED_COMPETITIONS_QUERY_KEY, 'view', readerKey] as const
}

/**
 * The key the student's entry readiness is cached under.
 *
 * @param readerKey - Who the answer is about.
 *
 * @returns The cache key.
 */
export function entryReadinessQueryKey(readerKey: HostedCompetitionsReaderKey): QueryKey {
  // Readiness is about the student rather than the reading, so it carries no language
  return [...HOSTED_COMPETITIONS_QUERY_KEY, 'entryReadiness', readerKey] as const
}
