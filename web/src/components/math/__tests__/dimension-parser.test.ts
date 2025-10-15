import { describe, expect, it } from 'vitest'

import { parseDimensions, parseDimensionToPixels } from '@/components/math/utils/dimension-parser'

describe('parseDimensionToPixels', () => {
  describe('pixel units (px)', () => {
    it('should parse integer pixel values', () => {
      expect(parseDimensionToPixels('100px')).toBe(100)
      expect(parseDimensionToPixels('0px')).toBe(0)
      expect(parseDimensionToPixels('1px')).toBe(1)
    })

    it('should parse decimal pixel values', () => {
      expect(parseDimensionToPixels('100.5px')).toBe(101) // rounded
      expect(parseDimensionToPixels('99.4px')).toBe(99) // rounded
      expect(parseDimensionToPixels('0.7px')).toBe(1) // rounded
    })

    it('should handle negative pixel values', () => {
      expect(parseDimensionToPixels('-50px')).toBe(-50)
      expect(parseDimensionToPixels('-0.5px')).toBe(-0) // rounded (Math.round(-0.5) = -0)
    })

    it('should handle pixels without unit (assume px)', () => {
      expect(parseDimensionToPixels('100')).toBe(100)
      expect(parseDimensionToPixels('50.5')).toBe(51) // rounded
    })
  })

  describe('point units (pt)', () => {
    it('should convert points to pixels correctly', () => {
      // 1pt = 1/72 inch, 1 inch = 96px
      // So 1pt = 96/72 = 1.333... px
      expect(parseDimensionToPixels('72pt')).toBe(96) // 72pt = 1 inch = 96px
      expect(parseDimensionToPixels('36pt')).toBe(48) // 36pt = 0.5 inch = 48px
      expect(parseDimensionToPixels('18pt')).toBe(24) // 18pt = 0.25 inch = 24px
      expect(parseDimensionToPixels('1pt')).toBe(1) // 1pt ≈ 1.33px, rounded to 1
    })
  })

  describe('pica units (pc)', () => {
    it('should convert picas to pixels correctly', () => {
      // 1pc = 12pt, 1pt = 96/72 px
      // So 1pc = 12 * 96/72 = 16px
      expect(parseDimensionToPixels('1pc')).toBe(16)
      expect(parseDimensionToPixels('6pc')).toBe(96) // 6pc = 1 inch = 96px
      expect(parseDimensionToPixels('0.5pc')).toBe(8)
    })
  })

  describe('inch units (in)', () => {
    it('should convert inches to pixels correctly', () => {
      expect(parseDimensionToPixels('1in')).toBe(96)
      expect(parseDimensionToPixels('0.5in')).toBe(48)
      expect(parseDimensionToPixels('2in')).toBe(192)
    })
  })

  describe('centimeter units (cm)', () => {
    it('should convert centimeters to pixels correctly', () => {
      // 1cm = 96px/2.54 ≈ 37.8px
      expect(parseDimensionToPixels('1cm')).toBe(38) // rounded
      expect(parseDimensionToPixels('2.54cm')).toBe(96) // 1 inch
      expect(parseDimensionToPixels('5cm')).toBe(189) // rounded
    })
  })

  describe('millimeter units (mm)', () => {
    it('should convert millimeters to pixels correctly', () => {
      // 1mm = 96px/25.4 ≈ 3.78px
      expect(parseDimensionToPixels('1mm')).toBe(4) // rounded
      expect(parseDimensionToPixels('25.4mm')).toBe(96) // 1 inch
      expect(parseDimensionToPixels('10mm')).toBe(38) // rounded
    })
  })

  describe('em and rem units', () => {
    it('should convert em units assuming 16px base', () => {
      expect(parseDimensionToPixels('1em')).toBe(16)
      expect(parseDimensionToPixels('2em')).toBe(32)
      expect(parseDimensionToPixels('0.5em')).toBe(8)
      expect(parseDimensionToPixels('1.5em')).toBe(24)
    })

    it('should convert rem units assuming 16px base', () => {
      expect(parseDimensionToPixels('1rem')).toBe(16)
      expect(parseDimensionToPixels('2rem')).toBe(32)
      expect(parseDimensionToPixels('0.75rem')).toBe(12)
    })
  })

  describe('percentage units', () => {
    it('should return undefined for percentage values', () => {
      expect(parseDimensionToPixels('50%')).toBeUndefined()
      expect(parseDimensionToPixels('100%')).toBeUndefined()
      expect(parseDimensionToPixels('0%')).toBeUndefined()
    })
  })

  describe('edge cases and invalid inputs', () => {
    it('should handle undefined and null inputs', () => {
      expect(parseDimensionToPixels(undefined)).toBeUndefined()
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      expect(parseDimensionToPixels(null as any)).toBeUndefined()
    })

    it('should handle empty and whitespace strings', () => {
      expect(parseDimensionToPixels('')).toBeUndefined()
      expect(parseDimensionToPixels('   ')).toBeUndefined()
      expect(parseDimensionToPixels('\t\n')).toBeUndefined()
    })

    it('should handle invalid formats', () => {
      expect(parseDimensionToPixels('not-a-number')).toBeUndefined()
      expect(parseDimensionToPixels('px100')).toBeUndefined()
      expect(parseDimensionToPixels('100 px')).toBeUndefined() // space between number and unit
      expect(parseDimensionToPixels('abc123px')).toBeUndefined()
    })

    it('should handle unknown units by treating as pixels', () => {
      expect(parseDimensionToPixels('100unknown')).toBe(100)
      expect(parseDimensionToPixels('50weird')).toBe(50)
    })

    it('should be case insensitive', () => {
      expect(parseDimensionToPixels('100PX')).toBe(100)
      expect(parseDimensionToPixels('72PT')).toBe(96)
      expect(parseDimensionToPixels('1EM')).toBe(16)
      expect(parseDimensionToPixels('1CM')).toBe(38)
    })

    it('should handle leading/trailing whitespace', () => {
      expect(parseDimensionToPixels('  100px  ')).toBe(100)
      expect(parseDimensionToPixels('\t50pt\n')).toBe(67) // rounded
    })

    it('should handle decimal-only numbers', () => {
      expect(parseDimensionToPixels('.5px')).toBe(1) // rounded
      expect(parseDimensionToPixels('.75em')).toBe(12)
    })

    it('should handle signed numbers', () => {
      expect(parseDimensionToPixels('+100px')).toBe(100)
      expect(parseDimensionToPixels('-50px')).toBe(-50)
      expect(parseDimensionToPixels('+1.5em')).toBe(24)
    })
  })
})

describe('parseDimensions', () => {
  it('should parse both width and height when valid', () => {
    const result = parseDimensions('100px', '200px')

    expect(result).toEqual({
      widthPx: 100,
      heightPx: 200,
      hasDimensions: true,
      originalWidth: '100px',
      originalHeight: '200px',
    })
  })

  it('should handle mixed units', () => {
    const result = parseDimensions('72pt', '1in')

    expect(result).toEqual({
      widthPx: 96,
      heightPx: 96,
      hasDimensions: true,
      originalWidth: '72pt',
      originalHeight: '1in',
    })
  })

  it('should handle undefined dimensions', () => {
    const result = parseDimensions(undefined, undefined)

    expect(result).toEqual({
      widthPx: undefined,
      heightPx: undefined,
      hasDimensions: false,
      originalWidth: undefined,
      originalHeight: undefined,
    })
  })

  it('should handle partial dimensions', () => {
    const result1 = parseDimensions('100px', undefined)
    expect(result1).toEqual({
      widthPx: 100,
      heightPx: undefined,
      hasDimensions: false,
      originalWidth: '100px',
      originalHeight: undefined,
    })

    const result2 = parseDimensions(undefined, '200px')
    expect(result2).toEqual({
      widthPx: undefined,
      heightPx: 200,
      hasDimensions: false,
      originalWidth: undefined,
      originalHeight: '200px',
    })
  })

  it('should handle invalid dimensions', () => {
    const result = parseDimensions('invalid', '50%')

    expect(result).toEqual({
      widthPx: undefined,
      heightPx: undefined, // percentage returns undefined
      hasDimensions: false,
      originalWidth: 'invalid',
      originalHeight: '50%',
    })
  })

  it('should require both valid dimensions for hasDimensions to be true', () => {
    const result1 = parseDimensions('100px', 'invalid')
    expect(result1.hasDimensions).toBe(false)

    const result2 = parseDimensions('invalid', '100px')
    expect(result2.hasDimensions).toBe(false)

    const result3 = parseDimensions('100px', '50%')
    expect(result3.hasDimensions).toBe(false)

    const result4 = parseDimensions('100px', '200px')
    expect(result4.hasDimensions).toBe(true)
  })

  it('should preserve original strings even when parsing fails', () => {
    const result = parseDimensions('weird-width', 'strange-height')

    expect(result.originalWidth).toBe('weird-width')
    expect(result.originalHeight).toBe('strange-height')
    expect(result.widthPx).toBeUndefined()
    expect(result.heightPx).toBeUndefined()
    expect(result.hasDimensions).toBe(false)
  })
})
