import { useAuth } from '@clerk/nextjs'
import { keepPreviousData, skipToken } from '@tanstack/react-query'

import { type FileLinks, uploadKeysIn } from '@/components/shared/utils/media-utils'
import { useApiQuery } from '@/hooks/use-api-query'
import { cachePolicy } from '@/lib/query-config'

import { getOwnFileLinks } from '../services/editor-upload-service'

/**
 * Links to the files a text being written names that the writer uploaded themselves. A link has hours left when it
 * comes, so the read runs again only when the files named change, or, once stale, when a component reading the
 * links mounts again. While the links to a changed set of files are on their way, the previous set's links stay.
 *
 * @param content - The text being written, in markdown.
 *
 * @returns The links by upload key, or undefined until the first ones come.
 */
export function useOwnFileLinks(content: string): FileLinks | undefined {
  // Who is writing
  const { userId } = useAuth()

  // The upload keys the text names, sorted, so moving a file within the text asks for nothing new
  const keys = uploadKeysIn(content).toSorted()

  // The links to the writer's own files among them
  const { data } = useApiQuery({
    queryKey: ['files', 'links', { readerId: userId ?? null, keys }],
    fetch: keys.length === 0 ? skipToken : (apiCall) => getOwnFileLinks(apiCall, keys),
    requireAuth: true,
    cachePolicy: cachePolicy.onDemand,
    placeholderData: keepPreviousData,
  })

  // The links, once they have come
  return data
}
