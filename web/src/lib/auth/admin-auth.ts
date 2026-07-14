import { auth } from '@clerk/nextjs/server'
import { getLocale } from 'next-intl/server'

import { ADMIN_ROLE } from '@/constants/auth-constants'
import { ROUTES } from '@/i18n/i18n'
import { redirect } from '@/i18n/navigation'

/**
 * Whether the current request is from an admin, read from the session token's `role` claim.
 *
 * @returns True when the caller carries the admin Role.
 */
export async function getIsAdmin(): Promise<boolean> {
  // Read the session claims from the Clerk token
  const { sessionClaims } = await auth()

  // Admin when the flat role claim matches
  return sessionClaims?.role === ADMIN_ROLE
}

/**
 * Guards a server component to admins, redirecting non-admins to the home page.
 */
export async function requireAdmin(): Promise<void> {
  // Admins pass through
  if (await getIsAdmin()) {
    return
  }

  // The current request locale
  const locale = await getLocale()

  // Send everyone else home
  redirect({ href: ROUTES.HOME, locale })
}
