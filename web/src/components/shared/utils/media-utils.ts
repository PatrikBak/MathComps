import { getRequiredEnv } from './env-utils'

/**
 * Resolves media: prefixed URLs to full R2 public URLs.
 * URLs without the media: prefix are returned unchanged.
 *
 * The key in media:key is a short key (without user-uploads/user_ prefix).
 * This function adds the prefixes back to build the full R2 path.
 *
 * @param url - The URL to resolve, may be media:key or a full URL.
 *
 * @returns The full URL for media: prefixed URLs, or the original URL.
 */
export function resolveMediaUrl(url: string): string {
  // If not a media: URL, return as-is
  if (!url.startsWith('media:')) return url

  // Extract the short key from media:key
  const shortKey = url.replace('media:', '')

  // Get the R2 base URL from environment
  const baseUrl = getRequiredEnv('NEXT_PUBLIC_R2_URL')

  // Build full URL: add user-uploads/ prefix and user_ prefix to user ID
  // shortKey format: {userId}/{folder}/{filename}
  const parts = shortKey.split('/')
  const fullKey = `user_${parts[0]}/${parts.slice(1).join('/')}`
  const result = `${baseUrl}/user-uploads/${fullKey}`

  // Return the resolved URL
  return result
}
