import { useLocale } from 'next-intl'

import { useApiQuery } from '@/hooks/use-api-query'
import { cachePolicy } from '@/lib/query-config'

import { ADMIN_DEFENSE_QUERY_KEY } from '../../conversation/hooks/conversation-cache'
import type { DefenseReviewFilterOptions } from '../model/defense-review-types'
import { fetchDefenseReviewFilterOptions } from '../services/defense-review-service'

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
 * Read for the whole surface rather than alongside each page of the queue: the counts are over every
 * conversation, so picking another filter leaves them where they are.
 *
 * @returns The options as described by {@link UseDefenseReviewFacetsResult}.
 */
export function useDefenseReviewFacets(): UseDefenseReviewFacetsResult {
  // The language the options are named in
  const locale = useLocale()

  // The option lists, which the queue needs the moment it opens
  const { data: options } = useApiQuery({
    // One list per language
    queryKey: [...ADMIN_DEFENSE_QUERY_KEY, 'filters', locale],
    fetch: fetchDefenseReviewFilterOptions,
    // The counts are an admin's own read, so they are made as them
    requireAuth: true,
    // Students keep holding conversations, so a new one reaches the options while the queue is open
    cachePolicy: cachePolicy.live,
  })

  // The options, once there are any
  return { options: options ?? null }
}
