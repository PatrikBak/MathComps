// The built-ins a browser in package.json's browserslist lacks, in place before the app's own code runs
import 'core-js/stable'

import * as Sentry from '@sentry/nextjs'

import { SENTRY_OPTIONS } from '@/lib/error-reporting/sentry-options'

// Browser faults reach Better Stack from the first script on
Sentry.init({
  ...SENTRY_OPTIONS,

  // A fault thrown from a script on another domain, such as a browser extension's, files nothing, since
  // the site cannot fix it. The page's domain matches the subdomains under it, Clerk's among them.
  allowUrls: [window.location.hostname],

  // A Clerk download that fails in the visitor's browser goes unreported, since a blocker, a bad network
  // or a crawler cut it off. The failure's message holds the file's address on Clerk's CDN, script and
  // chunks alike, and Clerk failing for every visitor shows on the uptime monitor on Clerk's script.
  ignoreErrors: ['/npm/@clerk/'],
})
