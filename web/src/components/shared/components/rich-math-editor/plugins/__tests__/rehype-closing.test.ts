import rehypeStringify from 'rehype-stringify'
import remarkParse from 'remark-parse'
import remarkRehype from 'remark-rehype'
import { unified } from 'unified'
import { describe, expect, it } from 'vitest'

import { rehypePlugins, remarkPlugins } from '../../utils/markdown-pipeline'
import { preprocessDisplayMath } from '../../utils/preprocessors'
import { rehypeClosing } from '../rehype-closing'

/**
 * Renders markdown through the renderer's own plugins with the closing mark placed at the end.
 *
 * @param markdown - The markdown+TeX source to render.
 * @returns The stringified HTML output.
 */
async function render(markdown: string): Promise<string> {
  // The text parsed and rendered as the renderer does it, then marked
  const file = await unified()
    .use(remarkParse)
    .use(remarkPlugins)
    .use(remarkRehype, { allowDangerousHtml: true })
    .use(rehypePlugins)
    .use(rehypeClosing)
    .use(rehypeStringify)
    .process(preprocessDisplayMath(markdown).text)

  // Hand back the rendered HTML
  return String(file)
}

describe('rehypeClosing', () => {
  it('puts the mark at the end of a last paragraph, after its last words', async () => {
    // Render a text of two paragraphs
    const html = await render('First paragraph.\n\nLast paragraph.')

    // The mark closes the last paragraph
    expect(html).toMatch(/<p>Last paragraph\.<text-closing><\/text-closing><\/p>$/)

    // And stands nowhere else
    expect(html.split('<text-closing>')).toHaveLength(2)
  })

  it('gives the mark a paragraph of its own after a text ending in a formula', async () => {
    // Render a text ending in display math
    const html = await render('Find all $x$ with\n\n$$x^2 = 1.$$')

    // The mark stands alone in a last paragraph
    expect(html).toMatch(/<p><text-closing><\/text-closing><\/p>$/)
  })

  it('gives the mark a paragraph of its own after a text ending in a list', async () => {
    // Render a text ending in a list of parts
    const html = await render('Prove that\n\n- the first part,\n- the second part.')

    // The mark stands alone after the list, never inside its last item
    expect(html).toMatch(/<\/ul>\s*<p><text-closing><\/text-closing><\/p>$/)
  })

  it('closes the last paragraph of a text ending in a note the renderer strips', async () => {
    // Render a paragraph, then an HTML comment, which leaves only the line break before it behind
    const html = await render('Last paragraph.\n\n<!-- a note -->')

    // The mark closes the paragraph rather than standing on a line of its own after the break
    expect(html).toMatch(/<p>Last paragraph\.<text-closing><\/text-closing><\/p>\s*$/)
  })
})
