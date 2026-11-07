import { getProblemImageUrl } from '@/components/shared/utils/asset-urls'

/**
 * Which markdown surface a {@link RichMathEditorRenderer} is rendering: this picks how bare `media:<id>` keys
 * resolve.
 *
 * - `userUploads` — files people upload into the editor (`media:<userId>/<folder>/<file>`), each reached only
 *   through its own {@link FileLinks} link.
 * - `problems` — problem-image content IDs served from the backend API.
 * - `handouts` — handout-image content IDs served from R2.
 */
export type ImageContext = 'userUploads' | 'problems' | 'handouts'

/**
 * Links to files people uploaded into the editor, keyed by the upload key a text names after `media:`. Each link
 * expires.
 */
export type FileLinks = Readonly<Record<string, string>>

/** What a markdown text writes before the id of a file it names. */
const MEDIA_SCHEME = 'media:'

/** Matches an upload key a markdown text names after `media:`, capturing the key. */
const UPLOAD_KEY_IN_TEXT = /media:([A-Za-z0-9]+\/[a-z]+\/[A-Za-z0-9._-]+)/g

/**
 * A `media:` URL taken apart.
 */
type MediaReference = {
  /** The file's id, everything between `media:` and the query. */
  id: string
  /** The query the URL carries, its `?` included, or empty for none. */
  query: string
}

/**
 * Takes a `media:` URL apart into the file's id and the query riding on it.
 *
 * @param url - The `media:` URL.
 *
 * @returns The id and the query.
 */
function mediaReferenceOf(url: string): MediaReference {
  // Everything after the scheme
  const rest = url.slice(MEDIA_SCHEME.length)

  // Where the query starts, if there is one
  const queryIndex = rest.indexOf('?')

  // The id before the query, and the query itself
  return queryIndex >= 0
    ? { id: rest.slice(0, queryIndex), query: rest.slice(queryIndex) }
    : { id: rest, query: '' }
}

/**
 * The upload keys a markdown text names, each once, in the order the text first names them.
 *
 * @param markdown - The text.
 *
 * @returns The keys.
 */
export function uploadKeysIn(markdown: string): string[] {
  // Every key the text names
  const keys = [...markdown.matchAll(UPLOAD_KEY_IN_TEXT)].map(([, key]) => key)

  // Each one once
  return [...new Set(keys)]
}

/**
 * Resolves a `media:` URL minted by the rich-math editor's upload flow to the link of the file it names. The editor
 * stores uploads as `media:<userId>/<folder>/<filename>`, any query after the key being the editor's own.
 * Non-`media:` URLs pass through unchanged so absolute URLs and root-relative paths can share the same resolver call.
 *
 * Only call this for URLs that come from the user-uploads pipeline, which is where every editor upload lands. For
 * markdown image resolution that needs to pick among problem / handout / user-upload hosts, use
 * {@link resolveMarkdownImageUrl} instead.
 *
 * @param url - The URL to resolve, either a `media:<upload key>` or any URL.
 * @param fileLinks - The links to the uploaded files the content names, or none for content that came with none.
 *
 * @returns The file's link when the input was `media:`-prefixed, or undefined for a file with no link, and otherwise
 *   the input unchanged.
 */
export function resolveUserUploadMediaUrl(
  url: string,
  fileLinks: FileLinks | undefined
): string | undefined {
  // Pass through anything that isn't a media: URL (absolute, relative, etc.)
  if (!url.startsWith(MEDIA_SCHEME)) return url

  // The upload key, the editor's query left behind, since a parameter added to a signed link breaks its signature
  const { id } = mediaReferenceOf(url)

  // The file's link, read only off the links' own keys, since a key such as `constructor` names something every
  // object inherits
  return fileLinks !== undefined && Object.hasOwn(fileLinks, id) ? fileLinks[id] : undefined
}

/**
 * Resolves a markdown image URL to its concrete host, picking the host based on which markdown surface the renderer
 * is mounted in. Editor uploads route through {@link resolveUserUploadMediaUrl} (their signed links); problems and
 * handouts route through {@link getProblemImageUrl} (which already knows the right per-type host for content-id-style
 * keys). Non-`media:` URLs pass through unchanged.
 *
 * When `context` is omitted the caller is declaring that its content has no `media:` URLs to dispatch (e.g. a dev
 * catalog rendering hand-written markdown with only relative/absolute URLs). Any `media:` URL that slips in is passed
 * through unresolved — it will fail to load, surfacing the mismatch loudly rather than corrupting silently.
 *
 * Any `?query` tail on a problem's or a handout's `media:` URL survives the resolution, so a version it carries
 * still reaches the browser.
 *
 * @param url - The image src as it appears in markdown.
 * @param context - Which markdown surface is hosting the renderer, when the surface uses `media:` URLs. Omit for
 *   surfaces without `media:` URLs.
 * @param fileLinks - The links to the uploaded files the content names, or none for content that came with none.
 *
 * @returns A fully-resolved URL the browser can fetch, or undefined for an uploaded file with no link.
 */
export function resolveMarkdownImageUrl(
  url: string,
  context: ImageContext | undefined,
  fileLinks: FileLinks | undefined
): string | undefined {
  // Pass through anything that isn't a media: URL (absolute, relative, etc.)
  if (!url.startsWith(MEDIA_SCHEME)) return url

  // No context declared — caller has no media: dispatch policy; let the URL through as-is so any media: that slips in
  // fails loudly at fetch time
  if (context === undefined) return url

  // Whatever the editor's own upload flow minted, which only its own link reaches
  if (context === 'userUploads') return resolveUserUploadMediaUrl(url, fileLinks)

  // Problem and handout images use a contentId-style key, not a path key — split off any ?query so the URL builder
  // sees a clean contentId
  const { id, query } = mediaReferenceOf(url)

  // The image's address, the query stitched back on
  return `${getProblemImageUrl(id, context)}${query}`
}
