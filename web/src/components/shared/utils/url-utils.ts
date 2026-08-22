import { getRequiredEnv } from '@/components/shared/utils/env-utils'

/**
 * Retrieves the public site URL from environment variables.
 *
 * @returns The site URL with no trailing slash
 */
function getSiteUrl(): string {
  return getRequiredEnv('NEXT_PUBLIC_SITE_URL')
}

/**
 * Retrieves the public Cloudflare R2 URL from environment variables.
 *
 * @returns The R2 public URL with no trailing slash
 */
export function getR2BaseUrl(): string {
  return getRequiredEnv('NEXT_PUBLIC_R2_URL')
}

/**
 * Builds API URL for the given endpoint path.
 *
 * Development: Uses /api prefix which Next.js strips via rewrites
 * Production: Uses direct backend URL without /api prefix
 *
 * @param path - The endpoint path
 * @param query - Optional query parameters, encoded and appended as a `?` string
 * @returns The full API URL for the endpoint
 */
export function buildApiUrl(path: string, query?: Record<string, string>): string {
  // The backend API base URL
  const baseUrl = getRequiredEnv('NEXT_PUBLIC_API_URL')

  // The encoded query string, or nothing when no params were given
  const suffix = query ? `?${new URLSearchParams(query)}` : ''

  // The path with its query string attached
  const fullPath = `${path}${suffix}`

  // Production: hit the backend URL directly
  // Development: fall back to the /api prefix Next.js rewrites away
  return baseUrl ? `${baseUrl}${fullPath}` : `/api${fullPath}`
}

/**
 * Generates a canonical URL for a given path.
 *
 * Canonical URLs tell search engines which URL is the authoritative "master"
 * version of a page. This prevents duplicate content issues when the same
 * content is accessible via multiple URLs (e.g., with/without trailing slash,
 * with query params, or via different domains).
 *
 * @param path - The URL path (should include locale prefix if applicable)
 *
 * @returns The full canonical URL (e.g., 'https://example.com/sk/about')
 */
export function getCanonicalUrl(path: string = ''): string {
  const cleanPath = path.startsWith('/') ? path : `/${path}`
  return `${getSiteUrl()}${cleanPath}`
}

/**
 * Reduces a URL to its bare display domain — the hostname without the `www.` prefix, scheme, or path.
 *
 * @param href - The absolute URL to reduce.
 *
 * @returns The bare domain (e.g. `skmo.sk` from `https://www.skmo.sk/about`).
 */
export function getDisplayDomain(href: string): string {
  // Parse out the hostname, then drop a leading www.
  return new URL(href).hostname.replace(/^www\./, '')
}

/**
 * Checks if the given URL is an external link (i.e. a link to a different domain)
 *
 * @param href - The URL to check
 *
 * @returns True if the URL is external, false otherwise
 */
export function isExternalHref(href: string): boolean {
  // scheme:// or //host, or common non-http schemes
  return /^(?:[a-z][a-z0-9+.-]*:)?\/\//i.test(href) || /^(mailto|tel|sms|geo):/i.test(href)
}

/**
 * Normalizes an App Router page's awaited `searchParams` (a plain record whose values may be a
 * string, a repeated-key array, or absent) into a {@link URLSearchParams}, so server code can read
 * the query with the same API the client uses.
 *
 * @param params - The awaited `searchParams` record from a page.
 *
 * @returns The query as {@link URLSearchParams} (repeated keys preserved, absent keys dropped).
 */
export function toUrlSearchParams(
  params: Record<string, string | string[] | undefined>
): URLSearchParams {
  // Flatten each key into one [key, value] pair per value, dropping absent keys
  const pairs = Object.entries(params).flatMap(([key, value]) => {
    // A repeated query key arrives as an array: keep every value
    if (Array.isArray(value)) return value.map((entry): [string, string] => [key, entry])
    // A single value is one pair; an absent key contributes nothing
    return value === undefined ? [] : [[key, value] as [string, string]]
  })
  // Assemble the query from the flattened pairs
  return new URLSearchParams(pairs)
}

/**
 * Puts a query string on the address the reader is on, leaving the page exactly where it stands.
 *
 * Written straight to history rather than routed, because the page has already answered for the values
 * being written and a route would refetch it to change nothing the reader can see.
 *
 * @param query - The query string, without its `?`; an empty one leaves the address bare.
 */
export function replaceQuery(query: string): void {
  // The address the reader is on
  const { pathname } = window.location

  // Put the query on it, leaving the page where it stands
  window.history.replaceState(null, '', query ? `${pathname}?${query}` : pathname)
}
