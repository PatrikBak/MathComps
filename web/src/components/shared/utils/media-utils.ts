import { getProblemImageUrl } from '@/components/features/problems/services/problem-api-urls'

import { getRequiredEnv } from './env-utils'

/**
 * Which markdown surface a {@link RichMathEditorRenderer} is rendering: this
 * picks the host that bare `media:<id>` keys resolve against.
 *
 * - `comments` — user-uploaded images on R2 (`media:<userId>/<folder>/<file>`).
 * - `problems` — problem-image content IDs served from the backend API.
 * - `handouts` — handout-image content IDs served from R2.
 */
export type ImageContext = 'comments' | 'problems' | 'handouts'

/**
 * Resolves a `media:` URL minted by the rich-math editor's upload flow to the
 * public R2 URL the browser can fetch. The editor stores user uploads as
 * `media:<userId>/<folder>/<filename>` (a compact form without the R2 path
 * prefix); this function reattaches the `user-uploads/user_` prefix that the
 * bucket layout actually uses. Non-`media:` URLs pass through unchanged so
 * absolute URLs and root-relative paths can share the same resolver call.
 *
 * Only call this for URLs that come from the user-uploads pipeline — comments
 * today, anywhere else editor uploads land tomorrow. For markdown image
 * resolution that needs to pick among problem / handout / user-upload hosts,
 * use {@link resolveMarkdownImageUrl} instead.
 *
 * @param url - The URL to resolve, either a `media:<short-key>` or any URL.
 *
 * @returns The full R2 URL when the input was `media:`-prefixed, otherwise the
 *   input unchanged.
 */
export function resolveUserUploadMediaUrl(url: string): string {
  // Pass through anything that isn't a media: URL (absolute, relative, etc.)
  if (!url.startsWith('media:')) return url

  // The short key is everything after `media:` — `<userId>/<folder>/<filename>`
  const shortKey = url.replace('media:', '')

  // R2 bucket lives at a deploy-time public URL
  const baseUrl = getRequiredEnv('NEXT_PUBLIC_R2_URL')

  // Rebuild the full bucket path: user uploads live under `user-uploads/`
  // and each user's folder is prefixed with `user_` to namespace them
  const parts = shortKey.split('/')
  const fullKey = `user_${parts[0]}/${parts.slice(1).join('/')}`
  return `${baseUrl}/user-uploads/${fullKey}`
}

/**
 * Resolves a markdown image URL to its concrete host, picking the host based
 * on which markdown surface the renderer is mounted in. Comments route through
 * {@link resolveUserUploadMediaUrl} (R2 user-uploads bucket); problems and
 * handouts route through {@link getProblemImageUrl} (which already knows the
 * right per-type host for content-id-style keys). Non-`media:` URLs pass
 * through unchanged.
 *
 * When `context` is omitted the caller is declaring that its content has no
 * `media:` URLs to dispatch (e.g. a dev catalog rendering hand-written
 * markdown with only relative/absolute URLs). Any `media:` URL that slips in
 * is passed through unresolved — it will fail to load, surfacing the
 * mismatch loudly rather than corrupting silently.
 *
 * Any `?query` tail on a `media:` URL survives the resolution so the
 * downstream `parseImageUrl` can still read the dimension/inline params off
 * the resolved URL.
 *
 * @param url - The image src as it appears in markdown.
 * @param context - Which markdown surface is hosting the renderer, when the
 *   surface uses `media:` URLs. Omit for surfaces without `media:` URLs.
 *
 * @returns A fully-resolved URL the browser can fetch.
 */
export function resolveMarkdownImageUrl(url: string, context?: ImageContext): string {
  // Pass through anything that isn't a media: URL (absolute, relative, etc.)
  if (!url.startsWith('media:')) return url

  // No context declared — caller has no media: dispatch policy; let the URL
  // through as-is so any media: that slips in fails loudly at fetch time
  if (context === undefined) return url

  // Comments share the user-uploads pipeline used by editor uploads everywhere
  if (context === 'comments') return resolveUserUploadMediaUrl(url)

  // Problem and handout images use a contentId-style key, not a path key —
  // split off any ?query so the URL builder sees a clean contentId, then
  // stitch the query string back onto the resolved URL for parseImageUrl
  const rest = url.slice('media:'.length)
  const queryIndex = rest.indexOf('?')
  const contentId = queryIndex >= 0 ? rest.slice(0, queryIndex) : rest
  const queryString = queryIndex >= 0 ? rest.slice(queryIndex) : ''
  return `${getProblemImageUrl(contentId, context)}${queryString}`
}
