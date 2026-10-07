import { auth } from '@clerk/nextjs/server'
import { headers } from 'next/headers'
import { getLocale } from 'next-intl/server'

import { ADMIN_ROLE, REQUEST_URL_HEADER, RETURN_URL_PARAM } from '@/constants/auth-constants'
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
 * Guards a server component to admins. A visitor who isn't signed in goes to the login page and comes back
 * to the same address, query included. Anyone signed in without the admin Role goes home.
 */
export async function requireAdmin(): Promise<void> {
  // Admins pass through
  if (await getIsAdmin()) {
    return
  }

  // The current request locale
  const locale = await getLocale()

  // The signed-in user's id, null for a visitor
  const { userId } = await auth()

  // A visitor logs in first and comes back here
  if (userId === null) {
    // The address this page was asked for
    const returnUrl = (await headers()).get(REQUEST_URL_HEADER)

    // Every page request passes the proxy, so only a request that skipped it lacks the address
    if (returnUrl === null) {
      throw new Error(
        `The request carries no ${REQUEST_URL_HEADER} header to return to after login`
      )
    }

    // Off to the login page, with the address to come back to
    redirect({ href: { pathname: ROUTES.LOGIN, query: { [RETURN_URL_PARAM]: returnUrl } }, locale })
  }

  // Send everyone else home
  redirect({ href: ROUTES.HOME, locale })
}
