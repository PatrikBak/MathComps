import type { Element, Root, RootContent } from 'hast'
import type { Transformer } from 'unified'

/** The tag standing in the rendered tree where a text's closing goes. */
export const CLOSING_TAG = 'text-closing'

/**
 * Whether a top-level node of the rendered tree is a block of the text, rather than blank text left between or after
 * the blocks.
 *
 * @param node - A top-level node of the rendered tree.
 * @returns Whether the node is a block of the text.
 */
function isBlock(node: RootContent): boolean {
  // Blank text says nothing; every other node is a block
  return node.type !== 'text' || node.value.trim() !== ''
}

/**
 * A rehype plugin marking where a text's closing goes: at the end of the last paragraph, so the closing can share its
 * last line, or in a paragraph of its own after a text that ends in anything else, such as a formula or a list.
 *
 * @returns The transformer placing the mark.
 */
export function rehypeClosing(): Transformer<Root> {
  return (tree) => {
    // The mark standing where the closing goes
    const mark: Element = { type: 'element', tagName: CLOSING_TAG, properties: {}, children: [] }

    // The text's last block
    const lastBlock = tree.children.findLast(isBlock)

    // A text ending in a paragraph takes the mark at that paragraph's end
    if (lastBlock?.type === 'element' && lastBlock.tagName === 'p') {
      // The mark after the paragraph's last words
      lastBlock.children.push(mark)

      // Placed
      return
    }

    // Any other text takes the mark in a paragraph of its own after everything
    tree.children.push({ type: 'element', tagName: 'p', properties: {}, children: [mark] })
  }
}
