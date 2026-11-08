import type { Element, Root } from 'hast'
import remarkParse from 'remark-parse'
import remarkRehype from 'remark-rehype'
import { unified } from 'unified'
import { visit } from 'unist-util-visit'
import { describe, expect, it } from 'vitest'

import { rehypePlugins, remarkPlugins } from '../../utils/markdown-pipeline'
import { preprocessDisplayMath } from '../../utils/preprocessors'
import {
  rehypeSourceRanges,
  SOURCE_END_ATTRIBUTE,
  SOURCE_START_ATTRIBUTE,
} from '../rehype-source-ranges'

/**
 * The stretches of the source the stamped elements of a rendered text claim.
 */
type StampedStretches = {
  /** What each top-level block claims, in order. */
  blocks: string[]
  /** What each stamped element inside the blocks claims, in document order. */
  inner: string[]
}

/**
 * Renders markdown through the renderer's own plugins with the source ranges stamped, and reads back the stretch
 * of the markdown each stamped element claims.
 *
 * @param markdown - The markdown+TeX source, as written.
 * @returns The stretches the top-level blocks claim, and those every stamped element inside them claims, each in
 * document order.
 */
function stampedStretches(markdown: string): StampedStretches {
  // The markdown preprocessed as the renderer does, with the way back to it
  const { text, toSourceOffset } = preprocessDisplayMath(markdown)

  // The shared pipeline, the stamping after it
  const processor = unified()
    .use(remarkParse)
    .use(remarkPlugins)
    .use(remarkRehype, { allowDangerousHtml: true })
    .use(rehypePlugins)
    .use(rehypeSourceRanges, { toSourceOffset })

  // The rendered tree
  const tree: Root = processor.runSync(processor.parse(text), text)

  /**
   * A function which reads the stretch of the source between an element's two stamps.
   *
   * @param element - A stamped element.
   * @returns The stretch it claims.
   */
  const stretchOf = (element: Element) =>
    markdown.slice(
      Number(element.properties[SOURCE_START_ATTRIBUTE.name]),
      Number(element.properties[SOURCE_END_ATTRIBUTE.name])
    )

  // The stamped elements below the top level, in document order
  const inner: Element[] = []

  // Every stamped element under the top level, collected
  visit(tree, 'element', (element, _index, parent) => {
    // Kept where it is stamped and not a top-level block
    if (parent?.type !== 'root' && SOURCE_START_ATTRIBUTE.name in element.properties) {
      inner.push(element)
    }
  })

  // Both sets of stretches
  return {
    blocks: tree.children
      .filter((child): child is Element => child.type === 'element')
      .map(stretchOf),
    inner: inner.map(stretchOf),
  }
}

describe('rehypeSourceRanges', () => {
  it('places each kind of block at its own stretch of the source', () => {
    // A heading, a list, a quote and a spoiler
    const { blocks: stretches } = stampedStretches(
      '## Head\n\n- one\n- two\n\n> quote\n\n:::spoiler[Hint]\nLike this.\n:::'
    )

    // Each block at its own markdown
    expect(stretches).toEqual([
      '## Head',
      '- one\n- two',
      '> quote',
      ':::spoiler[Hint]\nLike this.\n:::',
    ])
  })

  it('places a display formula in the gap between its neighbours, and the blocks after it as written', () => {
    // A formula on its own line between two paragraphs
    const { blocks: stretches } = stampedStretches('First paragraph\n\n$$x^2$$\n\nLast one')

    // The formula spans the gap, and the paragraph after it lands where it was written
    expect(stretches).toEqual(['First paragraph', '\n\n$$x^2$$\n\n', 'Last one'])
  })

  it('places the blocks a formula written mid-line splits its paragraph into', () => {
    // A formula glued to the prose on both sides
    const { blocks: stretches } = stampedStretches('Since $$a=b$$ holds\n\n## Head')

    // The prose before it, the formula, the prose after it, and the heading after all three
    expect(stretches).toEqual(['Since ', '$$a=b$$ ', 'holds', '## Head'])
  })

  it('places a run of display formulas together over the gap they stand in', () => {
    // Two formulas on lines of their own between two paragraphs
    const { blocks: stretches } = stampedStretches('Hence\n\n$$a=b$$\n$$=c$$\n\nDone')

    // Both over the whole gap
    expect(stretches).toEqual([
      'Hence',
      '\n\n$$a=b$$\n$$=c$$\n\n',
      '\n\n$$a=b$$\n$$=c$$\n\n',
      'Done',
    ])
  })

  it('places a formula ending the text over the rest of the text', () => {
    // A paragraph, then a formula closing the text
    const { blocks: stretches } = stampedStretches('First\n\n$$x^2$$')

    // The formula up to the very end
    expect(stretches).toEqual(['First', '\n\n$$x^2$$'])
  })

  it('places the items of a list and the paragraph of a quote at their own text', () => {
    // A list and a quote
    const { inner } = stampedStretches('- one\n- two\n\n> quote')

    // Each item and the quote's paragraph
    expect(inner).toEqual(['- one', '- two', 'quote'])
  })
})
