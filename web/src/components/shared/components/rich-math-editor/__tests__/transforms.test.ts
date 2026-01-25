import { describe, expect, it } from 'vitest'

import {
  createMarkdownLink,
  type EditContext,
  handleListContinuation,
  insertBlockCode,
  insertBlockMath,
  insertHeading,
  insertLatexCommand,
  insertLinePrefix,
  insertLink,
  insertSpoiler,
  isInMathMode,
  type TransformLabels,
  wrapSelection,
} from '../utils/transforms'

/** Mock labels for testing localized transforms */
const mockLabels: TransformLabels = {
  spoilerLabel: 'Hidden text',
  spoilerPlaceholder: 'hidden content',
  headingPlaceholder: 'Heading',
}

/**
 * Creates a test context for the editor.
 *
 * @param fullText The full text of the editor.
 * @param start The start position of the selection.
 * @param end The end position of the selection.
 *
 * @returns The test context.
 */
function createContext(fullText: string, start: number, end: number = start): EditContext {
  return {
    fullText,
    start,
    end,
    selectedText: fullText.substring(start, end),
  }
}

describe('isInMathMode', () => {
  describe('inline math ($...$)', () => {
    it('returns false when no math delimiters', () => {
      expect(isInMathMode('hello world')).toBe(false)
      expect(isInMathMode('')).toBe(false)
    })

    it('returns true when inside inline math', () => {
      expect(isInMathMode('text $x + ')).toBe(true)
      expect(isInMathMode('$')).toBe(true)
      expect(isInMathMode('hello $\\alpha')).toBe(true)
    })

    it('returns false when inline math is closed', () => {
      expect(isInMathMode('text $x + y$ more')).toBe(false)
      expect(isInMathMode('$x$')).toBe(false)
      expect(isInMathMode('$a$ and $b$')).toBe(false)
    })

    it('returns true when inside second inline math block', () => {
      expect(isInMathMode('$a$ and $b')).toBe(true)
    })
  })

  describe('display math ($$...$$)', () => {
    it('returns true when inside display math', () => {
      expect(isInMathMode('text $$x + ')).toBe(true)
      expect(isInMathMode('$$')).toBe(true)
      expect(isInMathMode('$$\n\\alpha')).toBe(true)
    })

    it('returns false when display math is closed', () => {
      expect(isInMathMode('text $$x + y$$ more')).toBe(false)
      expect(isInMathMode('$$x$$')).toBe(false)
    })

    it('returns true when inside second display math block', () => {
      expect(isInMathMode('$$a$$ and $$b')).toBe(true)
    })
  })

  describe('escaped dollars (\\$)', () => {
    it('ignores escaped dollar signs - not in math mode', () => {
      expect(isInMathMode('costs \\$5')).toBe(false)
      expect(isInMathMode('\\$100 is the price')).toBe(false)
      expect(isInMathMode('prices: \\$10, \\$20, \\$30')).toBe(false)
    })

    it('correctly handles escaped dollars mixed with real math', () => {
      // "\$5 in math $x$" - escaped dollar, then closed math
      expect(isInMathMode('\\$5 in math $x$')).toBe(false)
      // "\$5 and $x" - escaped dollar, then open math
      expect(isInMathMode('\\$5 and $x')).toBe(true)
    })

    it('handles escaped dollars inside math mode', () => {
      // "$price is \\$5" - inside math, escaped dollar is just text
      expect(isInMathMode('$price is \\$5')).toBe(true)
    })

    it('handles multiple escaped dollars', () => {
      // three escaped, not in math
      expect(isInMathMode('\\$\\$\\$')).toBe(false)
    })
  })

  describe('mixed inline and display', () => {
    it('handles display math followed by text', () => {
      expect(isInMathMode('$$a + b$$\nsome text')).toBe(false)
    })

    it('handles inline after display', () => {
      expect(isInMathMode('$$a$$\n$b')).toBe(true)
    })

    it('handles closed inline after display', () => {
      expect(isInMathMode('$$a$$\n$b$')).toBe(false)
    })

    it('handles inline inside display is still display mode', () => {
      // Inside $$ block, a single $ is just text
      expect(isInMathMode('$$a $ b')).toBe(true)
    })
  })

  describe('edge cases', () => {
    it('handles multiple $$ signs correctly', () => {
      // inside display math
      expect(isInMathMode('$$')).toBe(true)
    })

    it('handles newlines in display math', () => {
      expect(isInMathMode('$$\na = b\nc = d\n')).toBe(true)
    })

    it('handles complex nested scenario', () => {
      // ended with open inline math
      const text = 'Some text $$a + b = c$$ more text $x = '
      expect(isInMathMode(text)).toBe(true)
    })

    it('handles empty string', () => {
      expect(isInMathMode('')).toBe(false)
    })

    it('handles only whitespace', () => {
      expect(isInMathMode('   \n\t  ')).toBe(false)
    })
  })
})

describe('wrapSelection', () => {
  describe('without placeholder', () => {
    it('wraps empty selection with markers (no placeholder)', () => {
      const context = createContext('hello world', 5, 5)
      const result = wrapSelection(context, '**', '**')
      expect(result.newText).toBe('hello**** world')
      expect(result.cursorPosition).toBe(7) // after opening marker
      expect(result.selectionEnd).toBeUndefined() // no selection without placeholder
    })

    it('wraps selected text with markers', () => {
      const context = createContext('hello world', 0, 5)
      const result = wrapSelection(context, '**', '**')
      expect(result.newText).toBe('**hello** world')
      // Cursor is after before + selectedText (before closing marker)
      expect(result.cursorPosition).toBe(7) // 0 + 2(**) + 5(hello)
      expect(result.selectionEnd).toBeUndefined()
    })

    it('works with asymmetric markers', () => {
      const context = createContext('code here', 0, 4)
      const result = wrapSelection(context, '`', '`')
      expect(result.newText).toBe('`code` here')
    })

    it('handles markers at end of text', () => {
      const context = createContext('hello', 5, 5)
      const result = wrapSelection(context, '**', '**')
      expect(result.newText).toBe('hello****')
    })
  })

  describe('with placeholder', () => {
    it('inserts placeholder when nothing selected', () => {
      const context = createContext('hello world', 5, 5)
      const result = wrapSelection(context, '**', '**', 'text')
      expect(result.newText).toBe('hello**text** world')
      expect(result.cursorPosition).toBe(7) // start of placeholder
      expect(result.selectionEnd).toBe(11) // end of placeholder
    })

    it('inserts placeholder for inline math', () => {
      const context = createContext('', 0, 0)
      const result = wrapSelection(context, '$', '$', 'math')
      expect(result.newText).toBe('$math$')
      expect(result.cursorPosition).toBe(1) // after $
      expect(result.selectionEnd).toBe(5) // before closing $
    })

    it('ignores placeholder when text is selected', () => {
      const context = createContext('hello world', 0, 5)
      const result = wrapSelection(context, '**', '**', 'text')
      expect(result.newText).toBe('**hello** world')
      expect(result.cursorPosition).toBe(7)
      expect(result.selectionEnd).toBeUndefined() // no selection when text was already selected
    })

    it('inserts placeholder for inline code', () => {
      const context = createContext('before after', 7, 7)
      const result = wrapSelection(context, '`', '`', 'code')
      expect(result.newText).toBe('before `code`after')
      expect(result.cursorPosition).toBe(8) // after `
      expect(result.selectionEnd).toBe(12) // before closing `
    })
  })
})

describe('insertLinePrefix', () => {
  it('adds prefix at line start', () => {
    const context = createContext('hello', 0, 0)
    const result = insertLinePrefix(context, '> ')
    expect(result.newText).toBe('> hello')
  })

  it('prefixes current line when cursor is mid-line', () => {
    const context = createContext('hello world', 6, 6)
    const result = insertLinePrefix(context, '- ')
    // Changed behavior: prefixes the whole line instead of splitting it
    expect(result.newText).toBe('- hello world')
  })

  it('prefixes each line of selection', () => {
    const context = createContext('line1\nline2\nline3', 0, 17)
    const result = insertLinePrefix(context, '> ')
    expect(result.newText).toBe('> line1\n> line2\n> line3')
  })

  it('handles cursor at beginning of second line', () => {
    const context = createContext('first\nsecond', 6, 6)
    const result = insertLinePrefix(context, '- ')
    expect(result.newText).toBe('first\n- second')
  })

  it('prefixes each line properly even when selection starts/ends mid-line', () => {
    const text = 'line 1 text\nline 2 text'
    // Select from "text" on line 1 to "line" on line 2
    // "line 1 " length is 7. Start at 7.
    // "text\nline" length is 4+1+4 = 9. End at 16.
    const context = createContext(text, 7, 16)
    const result = insertLinePrefix(context, '> ')
    expect(result.newText).toBe('> line 1 text\n> line 2 text')
  })
})

describe('insertBlockMath', () => {
  it('inserts block math with placeholder when nothing selected', () => {
    const context = createContext('text', 4, 4)
    const result = insertBlockMath(context)
    expect(result.newText).toContain('$$')
    expect(result.newText).toContain('x^2') // placeholder
    expect(result.newText.match(/\$\$/g)?.length).toBe(2) // opening and closing
    expect(result.selectionEnd).toBeDefined() // should have selection for placeholder
  })

  it('wraps selected text in block math without selection bounds', () => {
    const context = createContext('x + y = z', 0, 9)
    const result = insertBlockMath(context)
    expect(result.newText).toContain('x + y = z')
    expect(result.newText).toContain('$$')
    expect(result.selectionEnd).toBeUndefined() // no selection when text already selected
  })

  it('selects placeholder text for immediate replacement', () => {
    const context = createContext('', 0, 0)
    const result = insertBlockMath(context)
    // Should contain placeholder 'x^2'
    // No trailing newline because isAtEnd is true (empty string)
    expect(result.newText).toBe('$$\nx^2\n$$')
    // cursorPosition should be at start of 'x^2', selectionEnd at end of 'x^2'
    expect(result.cursorPosition).toBe(3) // after '$$\n'
    expect(result.selectionEnd).toBe(6) // end of 'x^2'
  })
})

describe('insertBlockCode', () => {
  it('inserts fenced code block with placeholder when nothing selected', () => {
    const context = createContext('text', 4, 4)
    const result = insertBlockCode(context)
    expect(result.newText).toContain('```')
    expect(result.newText).toContain('code') // placeholder
    expect(result.newText.match(/```/g)?.length).toBe(2)
    expect(result.selectionEnd).toBeDefined() // should have selection for placeholder
  })

  it('wraps selected text in code block without selection bounds', () => {
    const context = createContext('const x = 1', 0, 11)
    const result = insertBlockCode(context)
    expect(result.newText).toContain('const x = 1')
    expect(result.newText).toContain('```')
    expect(result.selectionEnd).toBeUndefined() // no selection when text already selected
  })

  it('selects placeholder text for immediate replacement', () => {
    const context = createContext('', 0, 0)
    const result = insertBlockCode(context)
    // Should contain placeholder 'code'
    // No trailing newline because isAtEnd is true (empty string)
    expect(result.newText).toBe('```\ncode\n```')
    // cursorPos should be at start of 'code', selectionEnd at end of 'code'
    expect(result.cursorPosition).toBe(4) // after '```\n'
    expect(result.selectionEnd).toBe(8) // end of 'code'
  })
})

describe('insertLink', () => {
  it('inserts link template with placeholder when no selection', () => {
    const context = createContext('text', 4, 4)
    const result = insertLink(context)
    expect(result.newText).toBe('text[text]()')
    expect(result.cursorPosition).toBe(5) // start + 1 (after '[')
    expect(result.selectionEnd).toBe(9) // start + 1 + 4 ('text')
  })

  it('wraps selected text as link text with cursor in parens for URL', () => {
    const context = createContext('click here', 0, 10)
    const result = insertLink(context)
    expect(result.newText).toBe('[click here]()')
    // Cursor should be inside parentheses: [ + 'click here' + ]( = 1 + 10 + 2 = 13
    expect(result.cursorPosition).toBe(13)
    expect(result.selectionEnd).toBeUndefined()
  })
})

describe('createMarkdownLink', () => {
  it('creates link with provided URL', () => {
    const context = createContext('text', 0, 4)
    const result = createMarkdownLink(context, 'https://example.com')
    expect(result.newText).toBe('[text](https://example.com)')
  })

  it('does not normalize www. URLs (just trims)', () => {
    const context = createContext('text', 0, 4)
    const result = createMarkdownLink(context, '  www.example.com  ')
    expect(result.newText).toBe('[text](www.example.com)')
    expect(result.newText).not.toContain('https://')
  })
})

describe('insertHeading', () => {
  it('inserts h3 heading with placeholder', () => {
    const context = createContext('', 0, 0)
    const result = insertHeading(context, mockLabels)
    expect(result.newText).toBe('### Heading')
    expect(result.cursorPosition).toBe(4) // after '### '
    expect(result.selectionEnd).toBe(11) // end of 'Heading'
  })

  it('prefixes selected text on the line', () => {
    const context = createContext('My Title', 0, 8)
    const result = insertHeading(context, mockLabels)
    expect(result.newText).toBe('### My Title')
    expect(result.cursorPosition).toBe(12) // At the end of the line
    expect(result.selectionEnd).toBeUndefined()
  })

  it('prefixes current line when cursor is mid-line', () => {
    const context = createContext('text here', 5, 5)
    const result = insertHeading(context, mockLabels)
    expect(result.newText).toBe('### text here')
    // cursor at end of line: '### text here' length is 13
    expect(result.cursorPosition).toBe(13)
  })

  it('prefixes multiple lines', () => {
    const context = createContext('Line 1\nLine 2', 0, 13)
    const result = insertHeading(context, mockLabels)
    expect(result.newText).toBe('### Line 1\n### Line 2')
  })

  it('prefixes multiple lines even if some are empty', () => {
    const context = createContext('Line 1\n\nLine 2', 0, 14)
    const result = insertHeading(context, mockLabels)
    // insertLinePrefix will add prefix to empty line too -> "### "
    expect(result.newText).toBe('### Line 1\n### \n### Line 2')
  })
})

describe('handleListContinuation', () => {
  describe('unordered lists (- or *)', () => {
    it('continues list when line has content', () => {
      // "- item1|" -> Enter -> "- item1\n- |"
      const context = createContext('- item1', 7, 7)
      const result = handleListContinuation(context)
      expect(result).not.toBeNull()
      expect(result!.newText).toBe('- item1\n- ')
    })

    it('exits list when line is empty bullet', () => {
      // "- |" -> Enter -> "|" (removes the "- ")
      const context = createContext('- ', 2, 2)
      const result = handleListContinuation(context)
      expect(result).not.toBeNull()
      expect(result!.newText).toBe('\n')
    })

    it('preserves indentation when continuing', () => {
      const context = createContext('  - item', 8, 8)
      const result = handleListContinuation(context)
      expect(result).not.toBeNull()
      expect(result!.newText).toBe('  - item\n  - ')
    })

    it('works with asterisk bullets', () => {
      const context = createContext('* item', 6, 6)
      const result = handleListContinuation(context)
      expect(result).not.toBeNull()
      expect(result!.newText).toBe('* item\n* ')
    })

    it('handles multiline context', () => {
      const context = createContext('first line\n- item', 17, 17)
      const result = handleListContinuation(context)
      expect(result).not.toBeNull()
      expect(result!.newText).toBe('first line\n- item\n- ')
    })
  })

  describe('ordered lists (1., 2., etc)', () => {
    it('increments number when continuing', () => {
      // "1. item|" -> Enter -> "1. item\n2. |"
      const context = createContext('1. item', 7, 7)
      const result = handleListContinuation(context)
      expect(result).not.toBeNull()
      expect(result!.newText).toBe('1. item\n2. ')
    })

    it('exits list when line is empty number', () => {
      // "1. |" -> Enter -> "|"
      const context = createContext('1. ', 3, 3)
      const result = handleListContinuation(context)
      expect(result).not.toBeNull()
      expect(result!.newText).toBe('\n')
    })

    it('increments from any number', () => {
      const context = createContext('5. fifth item', 13, 13)
      const result = handleListContinuation(context)
      expect(result).not.toBeNull()
      expect(result!.newText).toBe('5. fifth item\n6. ')
    })

    it('preserves indentation', () => {
      const context = createContext('  1. indented', 13, 13)
      const result = handleListContinuation(context)
      expect(result).not.toBeNull()
      expect(result!.newText).toBe('  1. indented\n  2. ')
    })

    it('exits list when line is empty parenthesis-style number', () => {
      // "1) |" -> Enter -> "|"
      const context = createContext('1) ', 3, 3)
      const result = handleListContinuation(context)
      expect(result).not.toBeNull()
      expect(result!.newText).toBe('\n')
    })
  })

  describe('blockquotes (>)', () => {
    it('continues blockquote when line has content', () => {
      // "> quote|" -> Enter -> "> quote\n> |"
      const context = createContext('> quote', 7, 7)
      const result = handleListContinuation(context)
      expect(result).not.toBeNull()
      expect(result!.newText).toBe('> quote\n> ')
    })

    it('exits blockquote when line is empty', () => {
      // "> |" -> Enter -> "\n|" (adds a newline to break out of blockquote)
      const context = createContext('> ', 2, 2)
      const result = handleListContinuation(context)
      expect(result).not.toBeNull()
      expect(result!.newText).toBe('\n')
      expect(result!.cursorPosition).toBe(1)
    })

    it('creates a new paragraph when exiting blockquote to ensure separation', () => {
      // "> line 1\n> |" -> Enter -> "> line 1\n\n|"
      // This ensures that the new text is not treated as part of the blockquote
      const context = createContext('> line 1\n> ', 11, 11)
      const result = handleListContinuation(context)

      expect(result).not.toBeNull()
      expect(result!.newText).toBe('> line 1\n\n')
      // lineStart is 9 (after first newline), so cursor should be at 10
      expect(result!.cursorPosition).toBe(10)
    })

    it('handles multiline blockquotes', () => {
      const context = createContext('> first\n> second', 16, 16)
      const result = handleListContinuation(context)
      expect(result).not.toBeNull()
      expect(result!.newText).toBe('> first\n> second\n> ')
    })
  })

  describe('edge cases', () => {
    it('returns null for regular text', () => {
      const context = createContext('regular text', 12, 12)
      const result = handleListContinuation(context)
      expect(result).toBeNull()
    })

    it('returns null when cursor is at start of line (no line content before cursor)', () => {
      // The function looks at text from lineStart to cursor (start).
      // When cursor is at position 0, lineContent is empty, so no pattern matches.
      const context = createContext('- item', 0, 6)
      const result = handleListContinuation(context)
      expect(result).toBeNull()
    })

    it('returns null for empty text', () => {
      const context = createContext('', 0, 0)
      const result = handleListContinuation(context)
      expect(result).toBeNull()
    })
  })
})

describe('insertSpoiler', () => {
  it('inserts spoiler with placeholder when nothing selected', () => {
    const context = createContext('text', 4, 4)
    const result = insertSpoiler(context, mockLabels)
    expect(result.newText).toBe('text:::spoiler[Hidden text]\nhidden content\n:::')
    // text(4) + ":::spoiler[Hidden text]\n" (length: 11 + 11 + 2 = 24) = 28
    expect(result.cursorPosition).toBe(28)
    // selection covers 'hidden content' (length 14)
    expect(result.selectionEnd).toBe(42)
  })

  it('wraps selected text in spoiler', () => {
    const context = createContext('hidden secret', 0, 13)
    const result = insertSpoiler(context, mockLabels)
    expect(result.newText).toBe(':::spoiler[Hidden text]\nhidden secret\n:::')
    // ":::spoiler[Hidden text]\n" = 24 chars
    expect(result.cursorPosition).toBe(24) // after ":::spoiler[Hidden text]\n"
    expect(result.selectionEnd).toBeUndefined() // no selection when text was already selected
  })
})

describe('insertLatexCommand', () => {
  describe('single argument commands (e.g., \\hat, \\vec)', () => {
    it('inserts \\hat{} with cursor inside braces when not in math mode, nothing selected', () => {
      // Should wrap with $ and place cursor inside braces: $\hat{|}$
      const context = createContext('', 0, 0)
      const result = insertLatexCommand(context, 'hat', 1)
      expect(result.newText).toBe('$\\hat{}$')
      // Cursor: $ (1) + \hat{ (5) = 6
      expect(result.cursorPosition).toBe(6)
    })

    it('inserts \\hat{text} with cursor after when not in math mode, text selected', () => {
      // Selected "x" -> $\hat{x}|$
      const context = createContext('x', 0, 1)
      const result = insertLatexCommand(context, 'hat', 1)
      expect(result.newText).toBe('$\\hat{x}$')
      // Cursor: $ (1) + \hat{ (5) + x (1) + } (1) = 8
      expect(result.cursorPosition).toBe(8)
    })

    it('inserts \\vec{} without $ wrapper when already in math mode', () => {
      // Already in math: $a + |  -> $a + \vec{|}
      const context = createContext('$a + ', 5, 5)
      const result = insertLatexCommand(context, 'vec', 1)
      expect(result.newText).toBe('$a + \\vec{}')
      // Cursor: start (5) + \vec{ (5) = 10
      expect(result.cursorPosition).toBe(10)
    })

    it('inserts \\vec{x} in math mode when text selected', () => {
      // Already in math: $a + x|  -> $a + \vec{x}|
      const context = createContext('$a + x', 5, 6)
      const result = insertLatexCommand(context, 'vec', 1)
      expect(result.newText).toBe('$a + \\vec{x}')
      // Cursor: start (5) + \vec{ (5) + x (1) + } (1) = 12
      expect(result.cursorPosition).toBe(12)
    })
  })

  describe('simple symbols (argCount=0)', () => {
    it('inserts symbol with $ wrapper and cursor after when not in math mode', () => {
      // "alpha" -> "$\alpha|$"
      const context = createContext('', 0, 0)
      const result = insertLatexCommand(context, 'alpha', 0)
      expect(result.newText).toBe('$\\alpha$')
      // Cursor: $ (1) + \alpha (6) + $ (1) = 8
      expect(result.cursorPosition).toBe(8)
    })

    it('inserts symbol without $ wrapper when already in math mode', () => {
      // Already in math: "$x + |" -> "$x + \pi"
      const context = createContext('$x + ', 5, 5)
      const result = insertLatexCommand(context, 'pi', 0)
      expect(result.newText).toBe('$x + \\pi')
      // Cursor: start (5) + \pi (3) = 8
      expect(result.cursorPosition).toBe(8)
    })

    it('replaces selection with simple symbol', () => {
      // Selected "xyz" -> "$\alpha$"
      const context = createContext('xyz', 0, 3)
      const result = insertLatexCommand(context, 'alpha', 0)
      expect(result.newText).toBe('$\\alpha$')
      expect(result.cursorPosition).toBe(8)
    })

    it('handles symbol insertion in display math mode', () => {
      // Inside display math: "$$\n|" -> "$$\n\infty"
      const context = createContext('$$\n', 3, 3)
      const result = insertLatexCommand(context, 'infty', 0)
      expect(result.newText).toBe('$$\n\\infty')
      // Cursor: start (3) + \infty (6) = 9
      expect(result.cursorPosition).toBe(9)
    })
  })

  describe('two argument commands (e.g., \\frac)', () => {
    it('inserts \\frac{}{} with cursor in first braces when not in math mode, nothing selected', () => {
      // Should wrap with $ and place cursor in first braces: $\frac{|}{}$
      const context = createContext('', 0, 0)
      const result = insertLatexCommand(context, 'frac', 2)
      expect(result.newText).toBe('$\\frac{}{}$')
      // Cursor: $ (1) + \frac{ (6) = 7
      expect(result.cursorPosition).toBe(7)
    })

    it('inserts \\frac{text}{} with cursor in second braces when not in math mode, text selected', () => {
      // Selected "5" -> $\frac{5}{|}$
      const context = createContext('5', 0, 1)
      const result = insertLatexCommand(context, 'frac', 2)
      expect(result.newText).toBe('$\\frac{5}{}$')
      // Cursor: $ (1) + \frac{ (6) + 5 (1) + }{ (2) = 10
      expect(result.cursorPosition).toBe(10)
    })

    it('inserts \\frac{}{} without $ wrapper when already in math mode', () => {
      // Already in math: $a + |  -> $a + \frac{|}{}
      const context = createContext('$a + ', 5, 5)
      const result = insertLatexCommand(context, 'frac', 2)
      expect(result.newText).toBe('$a + \\frac{}{}')
      // Cursor: start (5) + \frac{ (6) = 11
      expect(result.cursorPosition).toBe(11)
    })

    it('inserts \\frac{x}{} in math mode when text selected', () => {
      // Already in math: $a + x|  -> $a + \frac{x}{|}
      const context = createContext('$a + x', 5, 6)
      const result = insertLatexCommand(context, 'frac', 2)
      expect(result.newText).toBe('$a + \\frac{x}{}')
      // Cursor: start (5) + \frac{ (6) + x (1) + }{ (2) = 14
      expect(result.cursorPosition).toBe(14)
    })
  })

  describe('edge cases', () => {
    it('defaults to argCount=0 when not specified (simple symbol)', () => {
      const context = createContext('', 0, 0)
      const result = insertLatexCommand(context, 'infty')
      expect(result.newText).toBe('$\\infty$')
      // Cursor at end: $ (1) + \infty (6) + $ (1) = 8
      expect(result.cursorPosition).toBe(8)
    })

    it('handles longer command names correctly (overline)', () => {
      const context = createContext('', 0, 0)
      const result = insertLatexCommand(context, 'overline', 1)
      expect(result.newText).toBe('$\\overline{}$')
      // Cursor: $ (1) + \overline{ (10) = 11
      expect(result.cursorPosition).toBe(11)
    })

    it('handles multi-character selection correctly', () => {
      const context = createContext('alpha + beta', 0, 12)
      const result = insertLatexCommand(context, 'hat', 1)
      expect(result.newText).toBe('$\\hat{alpha + beta}$')
      // Cursor after: $ (1) + \hat{ (5) + 12 chars + } (1) = 19
      expect(result.cursorPosition).toBe(19)
    })

    it('inserts command in middle of existing text', () => {
      const context = createContext('before  after', 7, 7)
      const result = insertLatexCommand(context, 'vec', 1)
      expect(result.newText).toBe('before $\\vec{}$ after')
      // Cursor: 7 (start) + $ (1) + \vec{ (5) = 13
      expect(result.cursorPosition).toBe(13)
    })

    it('inserts command in middle of existing text with selection', () => {
      const context = createContext('before x after', 7, 8)
      const result = insertLatexCommand(context, 'vec', 1)
      expect(result.newText).toBe('before $\\vec{x}$ after')
      // Cursor: 7 (start) + $ (1) + \vec{ (5) + x (1) + } (1) = 15
      expect(result.cursorPosition).toBe(15)
    })

    it('detects display math mode ($$) and does not wrap', () => {
      // Inside display math: $$\na + | -> no additional $ wrapper
      const context = createContext('$$\na + ', 7, 7)
      const result = insertLatexCommand(context, 'hat', 1)
      expect(result.newText).toBe('$$\na + \\hat{}')
      // Cursor: start (7) + \hat{ (5) = 12
      expect(result.cursorPosition).toBe(12)
    })

    it('handles 2-arg command with longer selection', () => {
      const context = createContext('numerator', 0, 9)
      const result = insertLatexCommand(context, 'frac', 2)
      expect(result.newText).toBe('$\\frac{numerator}{}$')
      // Cursor: $ (1) + \frac{ (6) + numerator (9) + }{ (2) = 18
      expect(result.cursorPosition).toBe(18)
    })

    it('correctly positions cursor in 2-arg command in display math mode', () => {
      const context = createContext('$$\n', 3, 3)
      const result = insertLatexCommand(context, 'frac', 2)
      expect(result.newText).toBe('$$\n\\frac{}{}')
      // Cursor: start (3) + \frac{ (6) = 9
      expect(result.cursorPosition).toBe(9)
    })
  })
})
