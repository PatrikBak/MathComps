// Forwards the body of each error report the browser posts on to Better Stack. An envelope whose
// DSN is not the site's own is refused, so the route relays nobody else's reports.
export { POST } from '@sentry/nextjs/tunnel'
