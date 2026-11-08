import { describe, expect, it } from 'vitest'

import {
  collapseExcessiveBreaks,
  preprocessDisplayMath,
  preprocessMarkdown,
} from '../preprocessors'

describe('preprocessDisplayMath', () => {
  describe('basic conversion', () => {
    it('converts inline display math to block format', () => {
      // A formula mid-line, rewritten
      const result = preprocessDisplayMath('text $$x^2$$ more').text

      // On lines of its own, between the prose around it
      expect(result).toBe('text \n$$\nx^2\n$$\n more')
    })

    it('handles already-block display math', () => {
      // A formula already on lines of its own, rewritten
      const result = preprocessDisplayMath('text\n$$\nx^2\n$$\nmore').text

      // Set off by a blank line on each side
      expect(result).toBe('text\n\n$$\nx^2\n$$\n\nmore')
    })

    it('trims whitespace inside math', () => {
      // A formula padded with spaces, rewritten
      const result = preprocessDisplayMath('$$  x^2  $$').text

      // With the spaces trimmed
      expect(result).toBe('\n$$\nx^2\n$$\n')
    })
  })

  describe('complex math', () => {
    it('handles fractions', () => {
      // A fraction, rewritten
      const result = preprocessDisplayMath('$$\\frac{a}{b}$$').text

      // With its backslashes kept
      expect(result).toBe('\n$$\n\\frac{a}{b}\n$$\n')
    })

    it('handles multiline math', () => {
      // A formula over two lines, rewritten
      const result = preprocessDisplayMath('$$a + b\n= c$$').text

      // With both lines inside the block
      expect(result).toBe('\n$$\na + b\n= c\n$$\n')
    })

    it('handles multiple display math blocks', () => {
      // Two formulas on one line, rewritten
      const result = preprocessDisplayMath('$$a$$ and $$b$$').text

      // Each on lines of its own
      expect(result).toBe('\n$$\na\n$$\n and \n$$\nb\n$$\n')
    })
  })

  describe('edge cases', () => {
    it('does not affect inline math', () => {
      // Inline maths, rewritten
      const result = preprocessDisplayMath('text $x^2$ more').text

      // Left as written
      expect(result).toBe('text $x^2$ more')
    })

    it('returns original when no display math', () => {
      // Plain text, rewritten
      const result = preprocessDisplayMath('Just text').text

      // Left as written
      expect(result).toBe('Just text')
    })

    it('handles empty display math', () => {
      // An empty formula, rewritten
      const result = preprocessDisplayMath('$$$$').text

      // An empty block
      expect(result).toBe('\n$$\n\n$$\n')
    })
  })

  describe('indentation preservation — own-line $$', () => {
    it('preserves 2-space indent (matches a `- ` marker depth)', () => {
      // A formula indented two spaces, rewritten
      const result = preprocessDisplayMath('  $$x = 1$$').text

      // With every line of the block indented the same
      expect(result).toBe('  \n  $$\n  x = 1\n  $$\n')
    })

    it('preserves 3-space indent (deeper than `- ` continuation)', () => {
      // A formula indented three spaces, rewritten
      const result = preprocessDisplayMath('   $$x = 1$$').text

      // With every line of the block indented the same
      expect(result).toBe('   \n   $$\n   x = 1\n   $$\n')
    })

    it('preserves 4-space indent (matches a nested list-item depth)', () => {
      // A formula indented four spaces, rewritten
      const result = preprocessDisplayMath('    $$x = 1$$').text

      // With every line of the block indented the same
      expect(result).toBe('    \n    $$\n    x = 1\n    $$\n')
    })

    it('preserves indent across multi-line math content (and avoids double-indenting continuation lines)', () => {
      // An indented formula over two lines, rewritten
      const result = preprocessDisplayMath('  $$a + b\n  = c$$').text

      // With each line indented once, the second included
      expect(result).toBe('  \n  $$\n  a + b\n  = c\n  $$\n')
    })
  })

  describe('indentation preservation — mid-line $$ inside a list item', () => {
    it('indents the math block to the `- ` marker depth (2 columns)', () => {
      // Math people sometimes write display math glued to the item's prose; the math block must stay in the item
      const result = preprocessDisplayMath('- the relation $$xy$$').text

      // With the block indented under the item's marker
      expect(result).toBe('- the relation \n  $$\n  xy\n  $$\n')
    })

    it('indents the math block to the `1. ` marker depth (3 columns)', () => {
      // A formula glued to a numbered item's prose, rewritten
      const result = preprocessDisplayMath('1. the relation $$xy$$').text

      // With the block indented under the item's marker
      expect(result).toBe('1. the relation \n   $$\n   xy\n   $$\n')
    })

    it('indents the math block to a nested `  - ` marker depth (4 columns)', () => {
      // A formula glued to a nested item's prose, rewritten
      const result = preprocessDisplayMath('  - the relation $$xy$$').text

      // With the block indented under the item's marker
      expect(result).toBe('  - the relation \n    $$\n    xy\n    $$\n')
    })

    it('does not propagate indent when $$ is mid-line outside any list', () => {
      // The two leading spaces are part of running prose, not of the $$ line itself
      const result = preprocessDisplayMath('  text $$x$$').text

      // With the block left unindented
      expect(result).toBe('  text \n$$\nx\n$$\n')
    })
  })

  describe('the way back to the text as written', () => {
    it.each([
      ['a formula mid-line', 'text $$x^2$$ more', 'more'],
      ['several formulas', 'a $$x$$ b $$y$$ c $$z$$ d', 'd'],
      ['a formula in a list item', '- the relation $$xy$$\n- next', 'next'],
    ])('maps the text after %s back to where it was written', (_description, content, word) => {
      // The processed text and its way back
      const { text, toSourceOffset } = preprocessDisplayMath(content)

      // The word's offset in the processed text, mapped back
      const mapped = toSourceOffset(text.indexOf(word))

      // At the word as written
      expect(mapped).toBe(content.indexOf(word))
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
