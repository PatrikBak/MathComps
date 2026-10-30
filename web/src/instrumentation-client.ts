import * as Sentry from '@sentry/nextjs'

import { SENTRY_OPTIONS } from '@/lib/error-reporting/sentry-options'

// Browser faults reach Better Stack from the first script on
Sentry.init({
  ...SENTRY_OPTIONS,

  // A fault thrown from a script on another domain, such as a browser extension's, files nothing, since
  // the site cannot fix it. The page's domain matches the subdomains under it, Clerk's among them.
  allowUrls: [window.location.hostname],
})
