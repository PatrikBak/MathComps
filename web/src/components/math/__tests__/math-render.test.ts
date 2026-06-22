import { describe, expect, it } from 'vitest'

import { inlineBlockToMathSource, renderMathContentToHtml } from '../utils/math-render'

describe('renderMathContentToHtml', () => {
  it('wraps inline math in a .math-nowrap span', () => {
    // Render inline math glued to a trailing period
    const html = renderMathContentToHtml('text $x$. more')

    // The wrapper must directly enclose the inline KaTeX root
    expect(html).toMatch(/<span class="math-nowrap"><span class="katex"/)
  })

  it('pulls trailing punctuation inside the inline wrapper', () => {
    // Render inline math followed by a period and more prose
    const html = renderMathContentToHtml('text $x$. more')

    // The period is glued in (between KaTeX close and wrapper close); the space-led rest stays outside
    expect(html).toContain('</span>.</span>')
    expect(html).toContain('</span> more')
  })

  it('pulls a leading bracket inside the inline wrapper', () => {
    // Render inline math hugged by parentheses
    const html = renderMathContentToHtml('a ($x$) b')

    // The opening paren leads the wrapper and the closing paren trails inside it
    expect(html).toMatch(/<span class="math-nowrap">\(<span class="katex"/)
    expect(html).toContain('</span>)</span>')
  })

  it('does not wrap display math in .math-nowrap', () => {
    // Render a display-math block
    const html = renderMathContentToHtml('$$x$$')

    // Display math is block-level — it carries katex-display and no inline wrapper
    expect(html).toContain('katex-display')
    expect(html).not.toContain('math-nowrap')
  })

  it('escapes plain text segments', () => {
    // Render prose containing HTML-significant characters and no math
    const html = renderMathContentToHtml('a < b & c')

    // The angle bracket and ampersand are escaped; nothing is treated as math
    expect(html).toContain('a &lt; b &amp; c')
    expect(html).not.toContain('math-nowrap')
  })

  it('returns an empty string for empty input', () => {
    // Render an empty string
    const html = renderMathContentToHtml('')

    // Empty in, empty out
    expect(html).toBe('')
  })

  it('renders mixed text and inline math together', () => {
    // Render a sentence interleaving prose and two inline formulas
    const html = renderMathContentToHtml('Let $a$ and $b$ be primes.')

    // Both formulas are wrapped, and the surrounding prose is preserved
    expect(html.split('class="math-nowrap"').length - 1).toBe(2)
    expect(html).toContain('be primes.')
  })

  it('html-escapes the punctuation it glues into the wrapper', () => {
    // Render inline math hugged by a less-than sign (HTML-significant)
    const html = renderMathContentToHtml('a $x$<b')

    // The hugging run is escaped inside the wrapper, never emitted as raw markup
    expect(html).toContain('&lt;b</span>')
    expect(html).not.toContain('<b')
  })

  it('glues a shared text run to the first formula only, never both', () => {
    // Two formulas separated by a single bare character that hugs both sides
    const html = renderMathContentToHtml('$a$x$b$')

    // The first formula consumes the run; the second wrapper must not start with a duplicate of it
    expect(html).toContain('</span>x</span>')
    expect(html).not.toContain('class="math-nowrap">x')
  })

  it('wraps two delimiter-adjacent formulas without gluing them together', () => {
    // Render two inline formulas written back-to-back with no text between
    const html = renderMathContentToHtml('$a$$b$')

    // Each formula gets its own wrapper; a non-text neighbor yields no glue
    expect(html.split('class="math-nowrap"').length - 1).toBe(2)
  })

  it('wraps inline math but leaves a display block in the same string unwrapped', () => {
    // Render one inline formula and one display block from a single source string
    const html = renderMathContentToHtml('$a$ text $$D$$')

    // Only the inline formula is wrapped; the display block renders block-level, outside any wrapper
    expect(html.split('class="math-nowrap"').length - 1).toBe(1)
    expect(html).toContain('katex-display')
  })
})

describe('inlineBlockToMathSource', () => {
  it('returns an empty string for a null block', () => {
    // Flatten an absent block
    const source = inlineBlockToMathSource(null)

    // Absent input flattens to nothing
    expect(source).toBe('')
  })

  it('passes plain text through verbatim', () => {
    // Flatten a bare text leaf
    const source = inlineBlockToMathSource({ type: 'text', text: 'Pythagoras' })

    // Text is reproduced as-is
    expect(source).toBe('Pythagoras')
  })

  it('wraps inline math in single-dollar delimiters', () => {
    // Flatten an inline math leaf
    const source = inlineBlockToMathSource({ type: 'math', text: 'a^2+b^2', isDisplay: false })

    // Inline math comes back delimited for re-rendering
    expect(source).toBe('$a^2+b^2$')
  })

  it('wraps display math in double-dollar delimiters', () => {
    // Flatten a display math leaf
    const source = inlineBlockToMathSource({ type: 'math', text: 'a^2+b^2', isDisplay: true })

    // Display math comes back in its own delimiters
    expect(source).toBe('$$a^2+b^2$$')
  })

  it('flattens a paragraph by concatenating its children in order', () => {
    // Flatten a paragraph mixing prose and an inline formula
    const source = inlineBlockToMathSource({
      type: 'paragraph',
      highligted: false,
      content: [
        { type: 'text', text: 'The ' },
        { type: 'math', text: 'x', isDisplay: false },
        { type: 'text', text: ' case' },
      ],
    })

    // The children flatten left-to-right with math re-delimited
    expect(source).toBe('The $x$ case')
  })

  it('recurses through bold and italic wrappers', () => {
    // Flatten a bold wrapper around an italic wrapper around text
    const source = inlineBlockToMathSource({
      type: 'bold',
      content: [{ type: 'italic', content: [{ type: 'text', text: 'deep' }] }],
    })

    // Formatting wrappers contribute only their flattened children
    expect(source).toBe('deep')
  })

  it('returns an empty string for block types without an inline source', () => {
    // Flatten an image reference, which has no inline-title representation
    const source = inlineBlockToMathSource({ type: 'image', id: 'fig-1', scale: 1, isInline: true })

    // Unsupported block types flatten to nothing
    expect(source).toBe('')
  })
})
