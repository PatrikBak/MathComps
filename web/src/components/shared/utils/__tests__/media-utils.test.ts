import { describe, expect, it, vi } from 'vitest'

// envMap inside env-utils captures process.env at module-load time, so the env
// vars consumed by the URL builders must be set before that import resolves
vi.hoisted(() => {
  process.env.NEXT_PUBLIC_API_URL = 'https://api.example.test'
  process.env.NEXT_PUBLIC_R2_URL = 'https://r2.example.test'
})

import { resolveMarkdownImageUrl, resolveUserUploadMediaUrl } from '../media-utils'

describe('resolveUserUploadMediaUrl', () => {
  describe('non-media: URLs pass through unchanged', () => {
    // The resolver is allowed to receive arbitrary URLs (the renderer's <a>
    // handler hands it every href, not just attachment links), so anything
    // without the `media:` prefix must round-trip exactly
    it('returns absolute URLs unchanged', () => {
      const url = 'https://cdn.example.com/file.pdf'
      expect(resolveUserUploadMediaUrl(url)).toBe(url)
    })

    it('returns root-relative URLs unchanged', () => {
      const url = '/handouts/intro.pdf'
      expect(resolveUserUploadMediaUrl(url)).toBe(url)
    })

    it('returns an empty string unchanged', () => {
      expect(resolveUserUploadMediaUrl('')).toBe('')
    })
  })

  describe('media: keys rebuild the R2 user-uploads path', () => {
    // The editor stores uploads as `media:<userId>/<folder>/<file>`; the
    // resolver reattaches the `user-uploads/user_` prefix the bucket uses
    it('rebuilds the full bucket path from a bare short key', () => {
      expect(resolveUserUploadMediaUrl('media:user-id-1/images/photo.png')).toBe(
        'https://r2.example.test/user-uploads/user_user-id-1/images/photo.png'
      )
    })

    // Nested folders inside the user's namespace must survive intact
    it('preserves nested folder segments', () => {
      expect(resolveUserUploadMediaUrl('media:user-id-1/attachments/2026/notes.pdf')).toBe(
        'https://r2.example.test/user-uploads/user_user-id-1/attachments/2026/notes.pdf'
      )
    })

    // The editor appends `?scale=100` to image uploads; downstream consumers
    // read it off the resolved URL, so the resolver must not strip it
    it('preserves a trailing query string', () => {
      expect(resolveUserUploadMediaUrl('media:user-id-1/images/photo.png?scale=100')).toBe(
        'https://r2.example.test/user-uploads/user_user-id-1/images/photo.png?scale=100'
      )
    })
  })
})

describe('resolveMarkdownImageUrl', () => {
  describe('non-media: URLs pass through unchanged', () => {
    // Every context should leave non-prefixed URLs alone — they are already
    // resolvable (absolute http, root-relative, dev-placeholder paths)
    it('returns absolute URLs unchanged for every context', () => {
      const url = 'https://cdn.example.com/img.png'
      expect(resolveMarkdownImageUrl(url, 'comments')).toBe(url)
      expect(resolveMarkdownImageUrl(url, 'problems')).toBe(url)
      expect(resolveMarkdownImageUrl(url, 'handouts')).toBe(url)
    })

    it('returns root-relative URLs unchanged for every context', () => {
      const url = '/dev-placeholders/block.svg?width=800&height=400'
      expect(resolveMarkdownImageUrl(url, 'comments')).toBe(url)
      expect(resolveMarkdownImageUrl(url, 'problems')).toBe(url)
      expect(resolveMarkdownImageUrl(url, 'handouts')).toBe(url)
    })
  })

  describe('undefined context — caller has no media: dispatch policy', () => {
    // Surfaces without media: URLs (e.g. the dev catalog) omit the prop, so
    // the resolver must not assume a default host and must leave URLs alone
    it('passes non-media: URLs through unchanged', () => {
      const url = 'https://cdn.example.com/img.png'
      expect(resolveMarkdownImageUrl(url, undefined)).toBe(url)
    })

    // A media: URL slipping into a no-context surface is a caller bug; the
    // resolver leaves it raw so the failed fetch surfaces the mismatch loudly
    it('passes media: URLs through unchanged (no silent dispatch)', () => {
      const url = 'media:abc123?width=200'
      expect(resolveMarkdownImageUrl(url, undefined)).toBe(url)
    })
  })

  describe('"comments" context — delegates to resolveUserUploadMediaUrl', () => {
    // Parity assertion against the lower-level helper keeps the delegation
    // contract explicit; resolveUserUploadMediaUrl's own tests cover the
    // concrete URL shape so we don't duplicate the string here
    it('matches resolveUserUploadMediaUrl for a bare user-uploads key', () => {
      const url = 'media:user-id-1/images/photo.png'
      expect(resolveMarkdownImageUrl(url, 'comments')).toBe(resolveUserUploadMediaUrl(url))
    })

    it('matches resolveUserUploadMediaUrl when query params ride along', () => {
      const url = 'media:user-id-1/images/photo.png?scale=100'
      expect(resolveMarkdownImageUrl(url, 'comments')).toBe(resolveUserUploadMediaUrl(url))
    })
  })

  describe('"problems" context — R2 problems host', () => {
    // Bare contentIds (no path structure) get the R2 problems image host
    it('routes a bare contentId to the R2 problems endpoint', () => {
      expect(resolveMarkdownImageUrl('media:abc123', 'problems')).toBe(
        'https://r2.example.test/problems/abc123'
      )
    })

    // The query string must survive resolution so parseImageUrl can still
    // read width/height/inline/scale off the resolved URL downstream
    it('preserves a trailing query string after resolution', () => {
      expect(resolveMarkdownImageUrl('media:abc123?width=200&height=150', 'problems')).toBe(
        'https://r2.example.test/problems/abc123?width=200&height=150'
      )
    })

    // ?inline=true is the param the renderer reads to flow images with text
    it('preserves the inline param', () => {
      expect(resolveMarkdownImageUrl('media:abc123?inline=true', 'problems')).toBe(
        'https://r2.example.test/problems/abc123?inline=true'
      )
    })
  })

  describe('"handouts" context — R2 handouts host', () => {
    // Handouts use a different host than problems but the same contentId shape
    it('routes a bare contentId to the R2 handouts endpoint', () => {
      expect(resolveMarkdownImageUrl('media:fig-7', 'handouts')).toBe(
        'https://r2.example.test/handouts/fig-7'
      )
    })

    it('preserves a trailing query string after resolution', () => {
      expect(resolveMarkdownImageUrl('media:fig-7?width=400&height=300', 'handouts')).toBe(
        'https://r2.example.test/handouts/fig-7?width=400&height=300'
      )
    })
  })
})
