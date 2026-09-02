import { useLocale } from 'next-intl'

import { useApiQuery } from '@/hooks/use-api-query'
import { cachePolicy } from '@/lib/query-config'

import type { DefenseReviewFilterOptions } from '../model/defense-review-types'
import { fetchDefenseReviewFilterOptions } from '../services/defense-review-service'
import { reviewFilterOptionsQueryKey } from './defense-review-cache'

/**
 * What {@link useDefenseReviewFacets} hands back.
 */
type UseDefenseReviewFacetsResult = {
  /** What the filters can be set to; null until it has been read. */
  options: DefenseReviewFilterOptions | null
}

/**
 * Reads what the review queue's filters can be set to.
 *
 * Read once for the whole surface rather than alongside each page of the queue: the counts are over every
 * conversation, so an option reads as a standing fact instead of a number that moves whenever an unrelated
 * filter is picked.
 *
 * @returns The options as described by {@link UseDefenseReviewFacetsResult}.
 */
export function useDefenseReviewFacets(): UseDefenseReviewFacetsResult {
  // The language the options are named in
  const locale = useLocale()

  // The three option lists, which the queue needs the moment it opens
  const { data: options } = useApiQuery({
    queryKey: reviewFilterOptionsQueryKey(locale),
    fetch: fetchDefenseReviewFilterOptions,
    // The counts are an admin's own read, so they are made as them
    requireAuth: true,
    ...cachePolicy.userData,
  })

  // The options, once there are any
  return { options: options ?? null }
}
