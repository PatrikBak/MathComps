import { describe, expect, it } from 'vitest'

import { parseImageUrl } from '../image-url-params'

describe('parseImageUrl', () => {
  describe('happy path — recognised params', () => {
    it('returns defaults when no query string is present', () => {
      const result = parseImageUrl('images/fig.svg')
      expect(result.params).toEqual({ inline: false })
      expect(result.errors).toEqual([])
      expect(result.cleanUrl).toBe('images/fig.svg')
    })

    it('parses both width and height together', () => {
      const result = parseImageUrl('images/fig.svg?width=480&height=320')
      expect(result.params.width).toBe(480)
      expect(result.params.height).toBe(320)
      expect(result.errors).toEqual([])
      expect(result.cleanUrl).toBe('images/fig.svg')
    })

    it('parses inline=true', () => {
      const result = parseImageUrl('images/fig.svg?inline=true')
      expect(result.params.inline).toBe(true)
      expect(result.errors).toEqual([])
      expect(result.cleanUrl).toBe('images/fig.svg')
    })

    it('parses inline=false explicitly', () => {
      const result = parseImageUrl('images/fig.svg?inline=false')
      expect(result.params.inline).toBe(false)
      expect(result.errors).toEqual([])
    })

    it('parses scale as a percentage divided by 100', () => {
      const result = parseImageUrl('images/fig.svg?scale=50')
      expect(result.params.scale).toBe(0.5)
      expect(result.errors).toEqual([])
    })

    it('parses all four params together', () => {
      const result = parseImageUrl('images/fig.svg?width=120&height=80&inline=true&scale=75')
      expect(result.params).toEqual({
        width: 120,
        height: 80,
        inline: true,
        scale: 0.75,
      })
      expect(result.errors).toEqual([])
      expect(result.cleanUrl).toBe('images/fig.svg')
    })
  })

  describe('URL-shape preservation', () => {
    it('preserves a leading-slash absolute path', () => {
      const result = parseImageUrl('/dev/foo.svg?width=100&height=100')
      expect(result.cleanUrl).toBe('/dev/foo.svg')
    })

    it('preserves an https URL with origin and path', () => {
      const result = parseImageUrl('https://example.com/img.svg?width=200&height=100')
      expect(result.cleanUrl).toBe('https://example.com/img.svg')
    })

    it('preserves a media: scheme URL', () => {
      const result = parseImageUrl('media:abc123?width=240&height=160')
      expect(result.cleanUrl).toBe('media:abc123')
    })

    it('preserves a hash fragment alongside stripped query params', () => {
      const result = parseImageUrl('images/fig.svg?width=100&height=100#anchor')
      expect(result.cleanUrl).toBe('images/fig.svg#anchor')
    })

    it('keeps unknown params verbatim in cleanUrl while still flagging them', () => {
      const result = parseImageUrl('images/fig.svg?keep=yes&width=100&height=100')
      expect(result.cleanUrl).toBe('images/fig.svg?keep=yes')
      expect(result.errors.map((error) => error.message)).toContain(
        'Image URL has unknown parameter "keep"'
      )
    })
  })

  describe('error: partial dimensions', () => {
    it('flags width without height', () => {
      const result = parseImageUrl('images/fig.svg?width=400')
      expect(result.params.width).toBe(400)
      expect(result.params.height).toBeUndefined()
      expect(result.errors.map((error) => error.message)).toEqual([
        'Image URL has only one of width/height — both must be specified together',
      ])
    })

    it('flags height without width', () => {
      const result = parseImageUrl('images/fig.svg?height=300')
      expect(result.params.width).toBeUndefined()
      expect(result.params.height).toBe(300)
      expect(result.errors.map((error) => error.message)).toEqual([
        'Image URL has only one of width/height — both must be specified together',
      ])
    })
  })

  describe('error: malformed dimension values', () => {
    it('flags non-numeric width', () => {
      const result = parseImageUrl('images/fig.svg?width=abc&height=200')
      expect(result.params.width).toBeUndefined()
      expect(result.params.height).toBe(200)
      expect(result.errors.map((error) => error.message)).toContain(
        'Image URL has invalid width="abc" (expected a positive integer)'
      )
    })

    it('flags zero as a dimension value', () => {
      const result = parseImageUrl('images/fig.svg?width=0&height=200')
      expect(result.params.width).toBeUndefined()
      expect(result.errors.map((error) => error.message)).toContain(
        'Image URL has invalid width="0" (expected a positive integer)'
      )
    })

    it('flags a negative dimension value', () => {
      const result = parseImageUrl('images/fig.svg?width=-5&height=200')
      expect(result.params.width).toBeUndefined()
      expect(result.errors.map((error) => error.message)).toContain(
        'Image URL has invalid width="-5" (expected a positive integer)'
      )
    })

    it('flags a non-integer (decimal) dimension value', () => {
      const result = parseImageUrl('images/fig.svg?width=1.5&height=200')
      expect(result.params.width).toBeUndefined()
      expect(result.errors.map((error) => error.message)).toContain(
        'Image URL has invalid width="1.5" (expected a positive integer)'
      )
    })
  })

  describe('error: malformed inline value', () => {
    it('flags inline=yes', () => {
      const result = parseImageUrl('images/fig.svg?inline=yes')
      expect(result.params.inline).toBe(false)
      expect(result.errors.map((error) => error.message)).toEqual([
        'Image URL has invalid inline="yes" (expected "true" or "false")',
      ])
    })

    it('flags inline=1', () => {
      const result = parseImageUrl('images/fig.svg?inline=1')
      expect(result.params.inline).toBe(false)
      expect(result.errors.map((error) => error.message)).toEqual([
        'Image URL has invalid inline="1" (expected "true" or "false")',
      ])
    })
  })

  describe('error: malformed scale value', () => {
    it('flags non-numeric scale', () => {
      const result = parseImageUrl('images/fig.svg?scale=abc')
      expect(result.params.scale).toBeUndefined()
      expect(result.errors.map((error) => error.message)).toEqual([
        'Image URL has invalid scale="abc" (expected a positive number)',
      ])
    })

    it('flags negative scale', () => {
      const result = parseImageUrl('images/fig.svg?scale=-50')
      expect(result.params.scale).toBeUndefined()
      expect(result.errors.map((error) => error.message)).toEqual([
        'Image URL has invalid scale="-50" (expected a positive number)',
      ])
    })
  })

  describe('error: unknown params', () => {
    it('flags a misspelled width parameter', () => {
      const result = parseImageUrl('images/fig.svg?widht=400')
      expect(result.errors.map((error) => error.message)).toContain(
        'Image URL has unknown parameter "widht"'
      )
    })

    it('reports the unknown param error before any partial-dimension error', () => {
      // ?widht=400&height=300 has both an unknown key AND a partial-dim issue;
      // the unknown-param error should surface first so the typo is the headline
      const result = parseImageUrl('images/fig.svg?widht=400&height=300')
      expect(result.errors[0]?.message).toBe('Image URL has unknown parameter "widht"')
    })
  })

  describe('multiple errors', () => {
    it('accumulates every error rather than short-circuiting on the first', () => {
      const result = parseImageUrl('images/fig.svg?width=abc&inline=maybe&scale=-1&garbage=1')
      const messages = result.errors.map((error) => error.message)
      expect(messages).toContain('Image URL has unknown parameter "garbage"')
      expect(messages).toContain('Image URL has invalid width="abc" (expected a positive integer)')
      expect(messages).toContain(
        'Image URL has invalid inline="maybe" (expected "true" or "false")'
      )
      expect(messages).toContain('Image URL has invalid scale="-1" (expected a positive number)')
    })
  })

  describe('edge cases', () => {
    it('handles an empty input by returning defaults and the same string', () => {
      const result = parseImageUrl('')
      expect(result.params).toEqual({ inline: false })
      expect(result.errors).toEqual([])
      expect(result.cleanUrl).toBe('')
    })

    it('handles a string the URL parser cannot understand', () => {
      // A bare ":" is not a parseable URL (empty scheme); the function should
      // degrade gracefully rather than throw
      const result = parseImageUrl(':')
      expect(result.params).toEqual({ inline: false })
      expect(result.errors).toEqual([])
      expect(result.cleanUrl).toBe(':')
    })

    it('does not require a path before the query string', () => {
      const result = parseImageUrl('?width=100&height=100')
      expect(result.params.width).toBe(100)
      expect(result.params.height).toBe(100)
      expect(result.errors).toEqual([])
    })
  })
})
