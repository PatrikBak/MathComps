import { describe, expect, it, vi } from 'vitest'

// envMap inside env-utils captures process.env at module-load time, so the env vars consumed by the URL builders must
// be set before that import resolves
vi.hoisted(() => {
  process.env.NEXT_PUBLIC_API_URL = 'https://api.example.test'
  process.env.NEXT_PUBLIC_R2_URL = 'https://r2.example.test'
})

import { resolveMarkdownImageUrl, resolveUserUploadMediaUrl, uploadKeysIn } from '../media-utils'

/** An upload key, in the shape the editor names its uploads by. */
const PHOTO_KEY = 'reader1/images/photo.png'

/** The signed link the API handed out for {@link PHOTO_KEY}. */
const PHOTO_LINK =
  'https://store.example.test/user-uploads/user_reader1/images/photo.png?X-Amz-Signature=abc'

describe('resolveUserUploadMediaUrl', () => {
  describe('non-media: URLs pass through unchanged', () => {
    // The resolver is allowed to receive arbitrary URLs (the renderer's <a> handler hands it every href, not just
    // attachment links), so anything without the `media:` prefix must round-trip exactly
    it('returns absolute URLs unchanged', () => {
      const url = 'https://cdn.example.com/file.pdf'
      expect(resolveUserUploadMediaUrl(url, undefined)).toBe(url)
    })
  })

  describe('media: keys resolve to the links the content came with', () => {
    it('gives the link of the file the key names', () => {
      expect(resolveUserUploadMediaUrl(`media:${PHOTO_KEY}`, { [PHOTO_KEY]: PHOTO_LINK })).toBe(
        PHOTO_LINK
      )
    })

    // The editor appends a `?scale=` to image uploads, which names no file and would break the link's signature if it
    // rode along
    it('leaves the query the editor wrote behind', () => {
      expect(
        resolveUserUploadMediaUrl(`media:${PHOTO_KEY}?scale=100`, { [PHOTO_KEY]: PHOTO_LINK })
      ).toBe(PHOTO_LINK)
    })

    it('gives nothing for a file the links leave out', () => {
      expect(
        resolveUserUploadMediaUrl('media:reader1/images/other.png', { [PHOTO_KEY]: PHOTO_LINK })
      ).toBeUndefined()
    })

    it('gives nothing for content that came with no links', () => {
      expect(resolveUserUploadMediaUrl(`media:${PHOTO_KEY}`, undefined)).toBeUndefined()
    })

    // Anyone can write such a key into a comment, and something every object inherits is no file's link
    it('gives nothing for a key naming what every object inherits', () => {
      expect(resolveUserUploadMediaUrl('media:constructor', {})).toBeUndefined()
      expect(resolveUserUploadMediaUrl('media:__proto__', {})).toBeUndefined()
    })
  })
})

describe('uploadKeysIn', () => {
  it('names each uploaded file once, in the order the text first names it', () => {
    // A text showing an image twice and attaching a PDF between
    const text = [
      `![photo](media:${PHOTO_KEY}?scale=50)`,
      '[📎 notes.pdf](media:reader1/attachments/1-a.pdf)',
      `![photo again](media:${PHOTO_KEY}?scale=100)`,
    ].join('\n')

    // The keys it names
    const keys = uploadKeysIn(text)

    // Each once, without the scales
    expect(keys).toEqual([PHOTO_KEY, 'reader1/attachments/1-a.pdf'])
  })

  it("leaves out a figure's id and an address of any other kind", () => {
    // A problem figure's id and an outside image, neither an upload
    const text =
      '![figure](media:abc123?width=200&height=150) ![logo](https://cdn.example.com/a/b/c.png)'

    // No upload among them
    expect(uploadKeysIn(text)).toEqual([])
  })
})

describe('resolveMarkdownImageUrl', () => {
  describe('non-media: URLs pass through unchanged', () => {
    // Every context should leave non-prefixed URLs alone — they are already resolvable (absolute http, root-relative,
    // dev-placeholder paths)
    it('returns absolute URLs unchanged for every context', () => {
      const url = 'https://cdn.example.com/img.png'
      expect(resolveMarkdownImageUrl(url, 'userUploads', undefined)).toBe(url)
      expect(resolveMarkdownImageUrl(url, 'problems', undefined)).toBe(url)
      expect(resolveMarkdownImageUrl(url, 'handouts', undefined)).toBe(url)
    })
  })

  describe('undefined context — caller has no media: dispatch policy', () => {
    // A media: URL slipping into a no-context surface is a caller bug; the resolver leaves it raw so the failed fetch
    // surfaces the mismatch loudly
    it('passes media: URLs through unchanged (no silent dispatch)', () => {
      const url = 'media:abc123?width=200'
      expect(resolveMarkdownImageUrl(url, undefined, undefined)).toBe(url)
    })
  })

  describe('"userUploads" context — delegates to resolveUserUploadMediaUrl', () => {
    it("resolves an upload's key through the content's links", () => {
      expect(
        resolveMarkdownImageUrl(`media:${PHOTO_KEY}`, 'userUploads', { [PHOTO_KEY]: PHOTO_LINK })
      ).toBe(PHOTO_LINK)
    })
  })

  describe('"problems" context — R2 problems host', () => {
    // Bare contentIds (no path structure) get the R2 problems image host
    it('routes a bare contentId to the R2 problems endpoint', () => {
      expect(resolveMarkdownImageUrl('media:abc123', 'problems', undefined)).toBe(
        'https://r2.example.test/problems/abc123'
      )
    })

    // The query string must survive resolution, since a version in it is what tells the browser the figure's bytes
    // changed
    it('preserves a trailing query string after resolution', () => {
      expect(resolveMarkdownImageUrl('media:abc123?v=1a2b3c4d', 'problems', undefined)).toBe(
        'https://r2.example.test/problems/abc123?v=1a2b3c4d'
      )
    })
  })

  describe('"handouts" context — R2 handouts host', () => {
    // Handouts use a different host than problems but the same contentId shape
    it('routes a bare contentId to the R2 handouts endpoint', () => {
      expect(resolveMarkdownImageUrl('media:fig-7', 'handouts', undefined)).toBe(
        'https://r2.example.test/handouts/fig-7'
      )
    })
  })
})
