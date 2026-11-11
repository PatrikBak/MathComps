// The built-ins a browser in package.json's browserslist lacks, in place before the app's own code runs
import 'core-js/stable'

import * as Sentry from '@sentry/nextjs'

import { SENTRY_OPTIONS } from '@/lib/error-reporting/sentry-options'

// Browser faults reach Better Stack from the first script on
Sentry.init({
  ...SENTRY_OPTIONS,

  // A report's addresses stop at their #, since what follows it is kept from every server
  beforeSend: (event) => {
    // A function which cuts an address at its #
    const withoutFragment = (address: string | undefined) => address?.split('#')[0]

    // The page the fault happened on
    if (event.request !== undefined) event.request.url = withoutFragment(event.request.url)

    // Both ends of each move between pages before the fault
    for (const { category, data } of event.breadcrumbs ?? []) {
      // Only a move between pages records the page's addresses
      if (category !== 'navigation' || data === undefined) continue

      // The move's two ends
      data.from = withoutFragment(data.from)
      data.to = withoutFragment(data.to)
    }

    // The file each line of the fault ran in, which for a script written into the page is the page itself
    for (const { stacktrace } of event.exception?.values ?? []) {
      // Each line, its file cut at the #
      for (const frame of stacktrace?.frames ?? []) frame.filename = withoutFragment(frame.filename)
    }

    // The report, scrubbed
    return event
  },

  // A fault thrown from a script on another domain, such as a browser extension's, files nothing, since
  // the site cannot fix it. The page's domain matches the subdomains under it, Clerk's among them.
  allowUrls: [window.location.hostname],

  // A Clerk download that fails in the visitor's browser goes unreported, since a blocker, a bad network
  // or a crawler cut it off. The failure's message holds the file's address on Clerk's CDN, script and
  // chunks alike, and Clerk failing for every visitor shows on the uptime monitor on Clerk's script.
  ignoreErrors: ['/npm/@clerk/'],

  // Reports post to the site's own relay route, which forwards them to Better Stack, since content
  // blockers refuse Better Stack's domain. The path holds no word a block list matches, such as
  // sentry or telemetry.
  tunnel: '/api/relay',

  // The SDK's counts of what it dropped stay unsent. With every span sampled out, each page a
  // visitor leaves would send one, and Better Stack has no screen for them.
  sendClientReports: false,
})
