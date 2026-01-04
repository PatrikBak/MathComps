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
