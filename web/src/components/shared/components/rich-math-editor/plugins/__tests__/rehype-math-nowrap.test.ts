import rehypeKatex from 'rehype-katex'
import rehypeStringify from 'rehype-stringify'
import remarkMath from 'remark-math'
import remarkParse from 'remark-parse'
import remarkRehype from 'remark-rehype'
import { unified } from 'unified'
import { describe, expect, it } from 'vitest'

import { preprocessDisplayMath } from '../../utils/preprocessors'
import { rehypeMathNowrap } from '../rehype-math-nowrap'

/**
 * Renders markdown through a minimal KaTeX pipeline with the nowrap plugin
 * appended, mirroring the real renderer's preprocessing and plugin order
 * (preprocess -> math -> katex -> nowrap).
 *
 * @param markdown - The markdown+TeX source to render.
 * @param extraPasses - Extra `rehypeMathNowrap` passes, to probe idempotency.
 * @returns The stringified HTML output.
 */
async function render(markdown: string, extraPasses = 0): Promise<string> {
  // Base pipeline up to the first nowrap pass
  let processor = unified()
    .use(remarkParse)
    .use(remarkMath)
    .use(remarkRehype)
    .use(rehypeKatex)
    .use(rehypeMathNowrap)

  // Tack on additional nowrap passes to confirm re-runs don't nest wrappers
  for (let pass = 0; pass < extraPasses; pass++) {
    processor = processor.use(rehypeMathNowrap)
  }

  // Mirror the renderer's display-math preprocessing, then run and stringify
  const file = await processor.use(rehypeStringify).process(preprocessDisplayMath(markdown))

  // Hand back the rendered HTML
  return String(file)
}

/**
 * Counts non-overlapping occurrences of a substring.
 *
 * @param haystack - The string to scan.
 * @param needle - The substring to count.
 * @returns The number of times `needle` appears in `haystack`.
 */
function countOccurrences(haystack: string, needle: string): number {
  // Split on the needle — the gap count is the occurrence count
  return haystack.split(needle).length - 1
}

describe('rehypeMathNowrap', () => {
  it('wraps an inline KaTeX root in a .math-nowrap span', async () => {
    // Render inline math followed immediately by a period
    const html = await render('text $x$. more')

    // The wrapper must directly enclose the inline KaTeX root
    expect(html).toMatch(/<span class="math-nowrap"><span class="katex"/)
  })

  it('pulls a trailing period inside the wrapper, leaving the space outside', async () => {
    // Render inline math glued to a period and trailing prose
    const html = await render('text $x$. more')

    // The period sits between the KaTeX close and the wrapper close — glued in
    expect(html).toContain('</span>.</span>')

    // The space-led remainder stays outside the wrapper as normal flow
    expect(html).toContain('</span> more')
  })

  it('pulls a leading bracket inside the wrapper', async () => {
    // Render inline math hugged by an opening and closing parenthesis
    const html = await render('a ($x$) b')

    // The opening paren leads the wrapper, right before the KaTeX root
    expect(html).toMatch(/<span class="math-nowrap">\(<span class="katex"/)

    // The closing paren trails inside the wrapper, before it closes
    expect(html).toContain('</span>)</span>')
  })

  it('pulls a period after a bolded formula inside the bold run', async () => {
    // Render a bolded formula with the sentence's period written outside the bold
    const html = await render('a **$x$**. more')

    // The period renders inside the bold, right after the formula it belongs to
    expect(html).toContain('.</span></strong> more')
  })

  it('does not wrap display math', async () => {
    // Render a standalone display-math block
    const html = await render('$$x$$')

    // Display math renders its own block wrapper and needs no inline protection
    expect(html).toContain('katex-display')
    expect(html).not.toContain('math-nowrap')
  })

  it('wraps every inline formula in a paragraph', async () => {
    // Render a paragraph carrying two separate inline formulas
    const html = await render('$a$ and $b$')

    // Each inline root gets its own wrapper
    expect(countOccurrences(html, 'class="math-nowrap"')).toBe(2)
  })

  it('leaves markdown without math untouched', async () => {
    // Render plain prose with no math at all
    const html = await render('just plain text')

    // Nothing to wrap, nothing rendered as math
    expect(html).not.toContain('math-nowrap')
    expect(html).not.toContain('katex')
  })

  it('does not nest a second wrapper when run repeatedly', async () => {
    // Render with two extra nowrap passes on top of the base pass
    const html = await render('text $x$. more', 2)

    // The idempotency guard keeps it at exactly one wrapper
    expect(countOccurrences(html, 'class="math-nowrap"')).toBe(1)
  })
})
