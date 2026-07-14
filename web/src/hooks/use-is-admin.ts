import { useUser } from '@clerk/nextjs'

import { ADMIN_ROLE } from '@/constants/auth-constants'

/**
 * Whether the signed-in user is an admin, read client-side from their public metadata.
 *
 * @returns True when the user carries the admin Role.
 */
export function useIsAdmin(): boolean {
  // Clerk's client-side user
  const { user } = useUser()

  // Admin when the public-metadata role matches
  return user?.publicMetadata.role === ADMIN_ROLE
}
