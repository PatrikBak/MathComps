import { clerkMiddleware } from '@clerk/nextjs/server'
import createMiddleware from 'next-intl/middleware'

import { DEFAULT_LOCALE, localePrefix, pathnames, SUPPORTED_LOCALES } from '@/i18n/i18n'

/** Handles locale detection, URL rewriting, and localized pathnames. */
const intlMiddleware = createMiddleware({
  locales: SUPPORTED_LOCALES,
  defaultLocale: DEFAULT_LOCALE,
  localePrefix,
  pathnames,
  localeDetection: true,
})

/**
 * Combined middleware: Clerk auth + next-intl routing.
 *
 * Clerk wraps the request so `auth()` works in server components,
 * then delegates to next-intl for locale handling.
 */
export default clerkMiddleware(async (_auth, request) => {
  return intlMiddleware(request)
})

/** Paths the middleware should run on. */
export const config = {
  matcher: [
    // Skip Next.js internals and static files
    '/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)',
    // Always run for API routes
    '/(api|trpc)(.*)',
  ],
}
