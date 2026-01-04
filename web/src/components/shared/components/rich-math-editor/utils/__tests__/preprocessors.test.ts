import { describe, expect, it } from 'vitest'

import {
  collapseExcessiveBreaks,
  preprocessDisplayMath,
  preprocessMarkdown,
} from '../preprocessors'

describe('preprocessDisplayMath', () => {
  describe('basic conversion', () => {
    it('converts inline display math to block format', () => {
      const result = preprocessDisplayMath('text $$x^2$$ more')
      expect(result).toBe('text \n$$\nx^2\n$$\n more')
    })

    it('handles already-block display math', () => {
      const result = preprocessDisplayMath('text\n$$\nx^2\n$$\nmore')
      expect(result).toBe('text\n\n$$\nx^2\n$$\n\nmore')
    })

    it('trims whitespace inside math', () => {
      const result = preprocessDisplayMath('$$  x^2  $$')
      expect(result).toBe('\n$$\nx^2\n$$\n')
    })
  })

  describe('complex math', () => {
    it('handles fractions', () => {
      const result = preprocessDisplayMath('$$\\frac{a}{b}$$')
      expect(result).toBe('\n$$\n\\frac{a}{b}\n$$\n')
    })

    it('handles multiline math', () => {
      const result = preprocessDisplayMath('$$a + b\n= c$$')
      expect(result).toBe('\n$$\na + b\n= c\n$$\n')
    })

    it('handles multiple display math blocks', () => {
      const result = preprocessDisplayMath('$$a$$ and $$b$$')
      expect(result).toBe('\n$$\na\n$$\n and \n$$\nb\n$$\n')
    })
  })

  describe('edge cases', () => {
    it('does not affect inline math', () => {
      expect(preprocessDisplayMath('text $x^2$ more')).toBe('text $x^2$ more')
    })

    it('returns original when no display math', () => {
      expect(preprocessDisplayMath('Just text')).toBe('Just text')
    })

    it('handles empty display math', () => {
      const result = preprocessDisplayMath('$$$$')
      expect(result).toBe('\n$$\n\n$$\n')
    })
  })
})

describe('collapseExcessiveBreaks', () => {
  it('converts <br> tags to newlines', () => {
    expect(collapseExcessiveBreaks('line1<br>line2')).toBe('line1\nline2')
    expect(collapseExcessiveBreaks('line1<br/>line2')).toBe('line1\nline2')
    expect(collapseExcessiveBreaks('line1 <br > line2')).toBe('line1 \n line2')
  })

  it('collapses 3+ newlines to 2', () => {
    expect(collapseExcessiveBreaks('a\n\n\nb')).toBe('a\n\nb')
    expect(collapseExcessiveBreaks('a\n\n\n\n\nb')).toBe('a\n\nb')
  })

  it('collapses mixed <br> and newlines', () => {
    // <br><br><br> -> \n\n\n -> \n\n
    expect(collapseExcessiveBreaks('<br><br><br>')).toBe('\n\n')
    // \n<br>\n -> \n\n\n -> \n\n
    expect(collapseExcessiveBreaks('\n<br>\n')).toBe('\n\n')
    // <br>\n<br>\n -> \n\n\n\n -> \n\n
    expect(collapseExcessiveBreaks('<br>\n<br>\n')).toBe('\n\n')
  })

  it('preserves 1 or 2 newlines', () => {
    expect(collapseExcessiveBreaks('a\nb')).toBe('a\nb')
    expect(collapseExcessiveBreaks('a\n\nb')).toBe('a\n\nb')
  })

  it('preserves mixed content with only 1-2 breaks', () => {
    expect(collapseExcessiveBreaks('a<br>b')).toBe('a\nb')
    expect(collapseExcessiveBreaks('a<br><br>b')).toBe('a\n\nb')
    expect(collapseExcessiveBreaks('a<br>\nb')).toBe('a\n\nb')
  })
})

describe('preprocessMarkdown', () => {
  it('applies both preprocessors in correct order', () => {
    // 3 <br> tags should collapse to 2 newlines, then display math should be formatted
    const input = 'text<br><br><br>$$x^2$$'
    const result = preprocessMarkdown(input)

    // Stage 1: text\n\n$$x^2$$
    // Stage 2: text\n\n\n$$\nx^2\n$$\n
    // Note: preprocessDisplayMath adds \n around $$ blocks
    expect(result).toBe('text\n\n\n$$\nx^2\n$$\n')
  })

  it('handles complex mixed content', () => {
    const input = 'Start\n\n\n<br>The answer is $$\\frac{1}{2}$$\n\n\nend'
    const result = preprocessMarkdown(input)
    // \n\n\n\n -> \n\n
    // The answer is \n$$\n...
    // \n\n\n -> \n\n
    expect(result).toContain('Start\n\nThe answer is')
    expect(result).toContain('\n$$\n\\frac{1}{2}\n$$\n')
    expect(result).toContain('\n\nend')
  })
})
