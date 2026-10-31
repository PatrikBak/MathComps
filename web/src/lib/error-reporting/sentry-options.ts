import type { init } from '@sentry/nextjs'

import { getOptionalEnv } from '@/components/shared/utils/env-utils'

/**
 * The error-reporting settings the browser and the server start from. Errors go to Better Stack over
 * the Sentry protocol, and with no DSN the SDK stays off.
 */
export const SENTRY_OPTIONS: Parameters<typeof init>[0] = {
  // The Better Stack application's ingest address
  dsn: getOptionalEnv('NEXT_PUBLIC_SENTRY_DSN'),

  // Errors only, no spans
  tracesSampleRate: 0,

  // A student's IP and cookies stay out of every event. Without user info the SDK drops
  // every header carrying the IP, and Vercel's location headers, which place a visitor almost as well,
  // are filtered by their shared prefix. Vercel's cache header is filtered by name, since it
  // holds a bearer token for the deployment's cache and the SDK masks only headers whose names
  // look secret.
  dataCollection: {
    userInfo: false,
    cookies: false,
    httpHeaders: { request: { deny: ['x-vercel-ip-', 'x-vercel-sc-headers'] } },
  },
}
