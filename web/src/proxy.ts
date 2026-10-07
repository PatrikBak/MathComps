import { clerkMiddleware } from '@clerk/nextjs/server'
import { NextResponse } from 'next/server'
import createMiddleware from 'next-intl/middleware'

import { REQUEST_URL_HEADER } from '@/constants/auth-constants'
import { localePrefix, pathnames, SUPPORTED_LOCALES, UNMATCHED_VISITOR_LOCALE } from '@/i18n/i18n'

/** Handles locale detection, URL rewriting, and localized pathnames. */
const intlMiddleware = createMiddleware({
  locales: SUPPORTED_LOCALES,
  defaultLocale: UNMATCHED_VISITOR_LOCALE,
  localePrefix,
  pathnames,
  localeDetection: true,
  // Hreflang alternates come from each page's metadata, which knows every locale's slug
  alternateLinks: false,
})

/** Matches any locale-prefixed path under /dev/ (e.g. /en/dev/renderer-preview). */
const DEV_ROUTE_PATTERN = /^\/(?:sk|cs|en)\/dev(?:\/|$)/

/** Matches the app's own API routes (e.g. /api/files/upload-url). */
const API_ROUTE_PATTERN = /^\/api(?:\/|$)/

/**
 * Combined middleware: dev-route gate + Clerk auth + next-intl routing.
 *
 * Outside development, any `/<locale>/dev/...` URL answers 404, keeping internal
 * preview pages unreachable in production and out of search indexes. In development
 * the gate is bypassed and the request flows through normal locale routing.
 *
 * Clerk wraps the request so `auth()` works in server components and API routes. A page
 * then goes on to next-intl for locale handling, which an API route has no part in. A page
 * request also carries its own address in {@link REQUEST_URL_HEADER}, and next-intl forwards
 * every request header on to the page.
 */
export default clerkMiddleware(async (_auth, request) => {
  // An API route goes straight on to its handler, with no locale to route by
  if (API_ROUTE_PATTERN.test(request.nextUrl.pathname)) {
    return NextResponse.next()
  }

  // Dev-only preview pages answer 404 outside development
  if (process.env.NODE_ENV !== 'development' && DEV_ROUTE_PATTERN.test(request.nextUrl.pathname)) {
    return new NextResponse(null, { status: 404 })
  }

  // Stamp the request with the address it asks for, query included
  request.headers.set(REQUEST_URL_HEADER, `${request.nextUrl.pathname}${request.nextUrl.search}`)

  // Otherwise hand off to the locale-routing middleware
  return intlMiddleware(request)
})

/** Paths the middleware should run on. */
export const config = {
  matcher: [
    // Skip Next.js internals and static files (incl. robots.txt/sitemap.xml)
    '/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|txt|xml|docx?|xlsx?|zip|webmanifest)).*)',
    // Always run for API routes, whatever their path ends in
    '/api(.*)',
  ],
}
