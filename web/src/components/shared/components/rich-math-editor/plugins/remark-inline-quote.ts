import type { TextDirective } from 'mdast-util-directive'
import type { Transformer } from 'unified'
import type { Node } from 'unist'
import { visit } from 'unist-util-visit'

/**
 * Type guard for the `:quote[text]` text directive.
 *
 * @param node - The node to test.
 * @returns `true` when the node is a `textDirective` named `quote`.
 */
function isInlineQuoteDirective(node: Node): node is TextDirective {
  return node.type === 'textDirective' && (node as TextDirective).name === 'quote'
}

/**
 * Remark plugin that transforms `:quote[text]` text directives into inline
 * `<q>text</q>` elements.
 *
 * Validation errors are pushed as vfile messages so the headless validator can
 * surface them. The renderer ignores these errors and degrades gracefully.
 *
 * @returns A unified transformer that mutates inline quote directives in-place.
 */
export function remarkInlineQuote(): Transformer<Node> {
  return (tree, file) => {
    visit(tree, isInlineQuoteDirective, (node: TextDirective) => {
      // Reject `:quote[]` with no inner content
      if (node.children.length === 0) {
        file.message(':quote directive has empty content', node)
        return
      }

      // Reject any attributes — the inline quote is style-free by design
      const attrCount = Object.keys(node.attributes ?? {}).length
      if (attrCount > 0) {
        file.message(':quote directive does not accept attributes', node)
        return
      }

      // Render as <q> with no extra HTML attributes
      const data = node.data || (node.data = {})
      data.hName = 'q'
      data.hProperties = {}
    })
  }
}
