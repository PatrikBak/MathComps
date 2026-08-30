import { useQuery } from '@tanstack/react-query'
import { useLocale } from 'next-intl'

import { readyApiCall, useApi } from '@/hooks/use-api'
import { unwrap } from '@/lib/api/api-error'
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
  // The authenticated caller
  const api = useApi({ requireAuth: true })

  // The language the options are named in
  const locale = useLocale()

  // The three option lists, which the queue needs the moment it opens
  const query = useQuery({
    queryKey: reviewFilterOptionsQueryKey(locale),
    queryFn: async () => unwrap(await fetchDefenseReviewFilterOptions(readyApiCall(api))),
    ...cachePolicy.userData,
    enabled: api.state === 'ready',
  })

  // The options, once there are any
  return { options: query.data ?? null }
}
