import { useAuth } from '@clerk/nextjs'

import { useApiQuery } from '@/hooks/use-api-query'
import { cachePolicy } from '@/lib/query-config'

import type { Organization } from '../model/selection-types'
import { getOrganizations } from '../services/selection-service'

/**
 * The prefix the reader's organizations are cached under, whoever they were read as.
 */
const OWN_ORGANIZATIONS_QUERY_KEY = ['own-organizations'] as const

/**
 * Reads the organizations the signed-in reader is a member of, in the order {@link getOrganizations} gives them.
 *
 * Keyed by the reader, since signing in as somebody else never reloads the page, and an entry cached under anything
 * less hands the second reader the first one's organizations.
 *
 * @returns The organizations; none until a read has got through, and none for a reader who is not signed in.
 */
export function useOwnOrganizations(): readonly Organization[] {
  // Who is reading, once sign-in has settled
  const { userId, isLoaded } = useAuth()

  // The reader's organizations
  const { data } = useApiQuery({
    queryKey: [...OWN_ORGANIZATIONS_QUERY_KEY, isLoaded ? (userId ?? null) : null],
    fetch: getOrganizations,
    // The reader's own organizations, so they are read as the reader
    requireAuth: true,
    // Only an organization's list or name moves them, and nobody changes either from the site
    cachePolicy: cachePolicy.content,
  })

  // Whatever has arrived, none until then
  return data ?? []
}
