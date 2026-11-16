/**
 * Who a fault's page or request came from, so a fault a visitor met can be told apart from one a script
 * or a crawler caused. `background` is a server fault no request names, a route handler's own report
 * included.
 */
export type CallerKind = 'browser' | 'webhook' | 'crawler' | 'script' | 'background'

/**
 * Matches the User-Agent of a crawler, every major one naming itself a bot, a crawler or a spider.
 */
const CRAWLER_PATTERN = /bot|crawler|spider/i

/**
 * Matches the User-Agent of a browser a script drives, which otherwise reads like a visitor's.
 */
const AUTOMATED_BROWSER_PATTERN = /HeadlessChrome|Playwright/

/**
 * Reads who a page or a request came from. Every browser opens its User-Agent with `Mozilla/`, so
 * anything else is a tool, curl and the HTTP clients of every language among them.
 *
 * @param userAgent - The User-Agent, empty when none was sent.
 * @param isAutomated - Whether the browser reports a script driving it.
 *
 * @returns Who the page or the request came from, never `background`.
 */
export function callerKindOf(userAgent: string, isAutomated: boolean): CallerKind {
  // Svix, which delivers Clerk's webhooks
  if (userAgent.startsWith('Svix-Webhooks/')) return 'webhook'

  // A crawler, which may also present itself as a browser
  if (CRAWLER_PATTERN.test(userAgent)) return 'crawler'

  // A browser a script drives, by its own report or by its agent
  if (isAutomated || AUTOMATED_BROWSER_PATTERN.test(userAgent)) return 'script'

  // A visitor's browser, or else a tool, an empty agent included
  return userAgent.startsWith('Mozilla/') ? 'browser' : 'script'
}
