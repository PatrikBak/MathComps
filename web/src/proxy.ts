import { clerkMiddleware } from '@clerk/nextjs/server'

/**
 * Clerk middleware is required for:
 * 1. Making auth() work in server components (used in page.tsx)
 * 2. OAuth/SSO redirects to function properly
 */
export default clerkMiddleware()

/**
/** Copied from https://clerk.com/docs/nextjs/middleware 
 */
export const config = {
  matcher: [
    // Skip Next.js internals and all static files, unless found in search params
    '/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)',
    // Always run for API routes
    '/(api|trpc)(.*)',
  ],
}
