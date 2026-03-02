import { getRequiredEnv } from '@/components/shared/utils/env-utils'

/**
 * Retrieves the base API URL from environment variables.
 *
 * @returns The base API URL with no trailing slash
 */
export function getApiBaseUrl(): string {
  return getRequiredEnv('NEXT_PUBLIC_API_URL')
}

/**
 * Retrieves the public site URL from environment variables.
 *
 * @returns The site URL with no trailing slash
 */
export function getSiteUrl(): string {
  return getRequiredEnv('NEXT_PUBLIC_SITE_URL')
}

/**
 * Retrieves the public Cloudflare R2 URL from environment variables.
 * Used for serving handout assets (PDFs, images) from R2 storage.
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
 * @returns The full API URL for the endpoint
 */
export function buildApiUrl(path: string): string {
  // Get the base URL for any client-side API calls
  const baseUrl = getApiBaseUrl()

  // Production: use backend URL directly (no /api prefix on backend)
  // Development: use /api prefix which Next.js rewrites to strip it
  return baseUrl ? `${baseUrl}${path}` : `/api${path}`
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
 * Checks if the given URL is an external link (i.e. a link to a different domain)
 *
 * @param href - The URL to check
 *
 * @returns True if the URL is external, false otherwise
 */
export const isExternalHref = (href: string) => {
  // scheme:// or //host, or common non-http schemes
  return /^(?:[a-z][a-z0-9+.-]*:)?\/\//i.test(href) || /^(mailto|tel|sms|geo):/i.test(href)
}
