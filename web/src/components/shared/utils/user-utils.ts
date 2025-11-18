import type { UserResource } from '@clerk/types'

/**
 * Extracts a display name from a {@link UserResource}, falling back through available name fields.
 *
 * @param user - The Clerk user resource object (must be non-null and non-undefined)
 *
 * @returns The first existing value out of fullName, firstName, username, or '???'
 *
 */
export const getUserDisplayName = (user: NonNullable<UserResource>): string => {
  return user.fullName || user.firstName || user.username || '???'
}
