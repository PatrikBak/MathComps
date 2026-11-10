import rehypeStringify from 'rehype-stringify'
import remarkParse from 'remark-parse'
import remarkRehype from 'remark-rehype'
import { unified } from 'unified'
import { describe, expect, it } from 'vitest'

import { rehypePlugins, remarkPlugins } from '../../utils/markdown-pipeline'
import { preprocessDisplayMath } from '../../utils/preprocessors'

/**
 * Renders markdown through the renderer's own plugins, sanitizing included.
 *
 * @param markdown - The markdown+TeX source to render.
 * @returns The stringified HTML output.
 */
async function render(markdown: string): Promise<string> {
  // The shared pipeline
  const processor = unified()
    .use(remarkParse)
    .use(remarkPlugins)
    .use(remarkRehype, { allowDangerousHtml: true })
    .use(rehypePlugins)
    .use(rehypeStringify)

  // The markdown preprocessed as the renderer does, then run
  const file = await processor.process(preprocessDisplayMath(markdown).text)

  // The rendered HTML
  return String(file)
}

describe('remarkUnclaimedTextDirectives', () => {
  it('keeps a ratio and a time written without spaces', async () => {
    // A ratio and a time, each colon glued to the digits around it
    const html = await render('Poměr vyšel 1:2, o 12:30.')

    // The sentence as typed
    expect(html).toBe('<p>Poměr vyšel 1:2, o 12:30.</p>')
  })

  it('keeps the label and the attributes of an unclaimed directive as typed', async () => {
    // A word shaped like a directive with both a label and attributes
    const html = await render('a:b[**c**]{d=1} e')

    // The whole shape as text, its label left unrendered
    expect(html).toBe('<p>a:b[**c**]{d=1} e</p>')
  })

  it('leaves a claimed directive alone while putting back the one in its label', async () => {
    // An inline quote holding a ratio
    const html = await render(':quote[pomer 1:2]')

    // The quote, the ratio inside it as typed
    expect(html).toBe('<p><q>pomer 1:2</q></p>')
  })
})
