import { clerkMiddleware } from '@clerk/nextjs/server'
import { NextResponse } from 'next/server'
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

/** Matches any locale-prefixed path under /dev/ (e.g. /en/dev/renderer-preview). */
const DEV_ROUTE_PATTERN = /^\/(?:sk|cs|en)\/dev(?:\/|$)/

/**
 * Combined middleware: dev-route gate + Clerk auth + next-intl routing.
 *
 * Outside development, any `/<locale>/dev/...` URL is 404'd so internal preview
 * pages don't ship to production. In development the gate is bypassed and the
 * request flows through normal locale routing.
 *
 * Clerk wraps the request so `auth()` works in server components, then
 * delegates to next-intl for locale handling.
 */
export default clerkMiddleware(async (_auth, request) => {
  // Block dev-only preview pages outside development — keeps internal previews
  // out of production builds and search indexes
  if (process.env.NODE_ENV !== 'development' && DEV_ROUTE_PATTERN.test(request.nextUrl.pathname)) {
    return new NextResponse(null, { status: 404 })
  }

  // Otherwise hand off to the locale-routing middleware
  return intlMiddleware(request)
})

/** Paths the middleware should run on. */
export const config = {
  matcher: [
    // Skip Next.js internals, static files (incl. robots.txt/sitemap.xml), and API routes
    '/((?!_next|api|trpc|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|txt|xml|docx?|xlsx?|zip|webmanifest)).*)',
  ],
}
