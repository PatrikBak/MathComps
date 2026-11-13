import { useAuth } from '@clerk/nextjs'
import { keepPreviousData, skipToken } from '@tanstack/react-query'

import { useApiQuery } from '@/hooks/use-api-query'
import { cachePolicy } from '@/lib/query-config'

import type { DefensePhotoLinks } from '../model/defense-types'
import { getDefensePhotoLinks } from '../services/photo-service'

/**
 * Fresh links to the kept pages of photos the student has not sent yet. A link has hours left when it comes, so the
 * read runs again only when the photos named change, or, once stale, when a component reading the links mounts again.
 * While the links to a changed set of photos are on their way, the previous set's links stay.
 *
 * @param photoIds - The kept photos.
 *
 * @returns The links by photo id, or undefined until the first ones come.
 */
export function useDefensePhotoLinks(photoIds: readonly string[]): DefensePhotoLinks | undefined {
  // Who the photos are asked for as
  const { userId } = useAuth()

  // The photos, sorted, so a page moving among them asks for nothing new
  const sortedIds = photoIds.toSorted()

  // The links to the student's own unsent photos among them
  const { data } = useApiQuery({
    queryKey: ['defense', 'photos', 'links', { readerId: userId ?? null, photoIds: sortedIds }],
    fetch:
      sortedIds.length === 0 ? skipToken : (apiCall) => getDefensePhotoLinks(apiCall, sortedIds),
    requireAuth: true,
    cachePolicy: cachePolicy.onDemand,
    placeholderData: keepPreviousData,
  })

  // The links, once they have come
  return data
}
