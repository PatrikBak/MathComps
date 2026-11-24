import type { Paragraph, Root } from 'mdast'
import type { ContainerDirective } from 'mdast-util-directive'
import type { Transformer } from 'unified'
import { visit } from 'unist-util-visit'

/** The name a figure is written under, as in `:::figure[Obr. 1]`. */
const FIGURE_DIRECTIVE = 'figure'

/**
 * Whether a figure's child is the caption written in its `[…]`, which remark-directive parses into a paragraph of
 * its own.
 *
 * @param child - A child of the figure's directive.
 * @returns Whether the child is the caption.
 */
function isCaption(child: ContainerDirective['children'][number]): child is Paragraph {
  // The paragraph remark-directive marks as the label
  return child.type === 'paragraph' && child.data?.directiveLabel === true
}

/**
 * Remark plugin which turns a `:::figure[Caption]` container directive into a `<figure>`: its body (the pictures or
 * the table drawn as display math it shows), then the caption under it as a `<figcaption>`, inline math included. A
 * figure written without a caption, or with an empty one, gets no `<figcaption>`.
 *
 * @returns A unified transformer which turns each figure directive into its figure.
 */
export function remarkFigure(): Transformer<Root> {
  return (tree) => {
    // Each container directive in the text
    visit(tree, 'containerDirective', (node: ContainerDirective) => {
      // Only a figure, every other container left to its own plugin
      if (node.name !== FIGURE_DIRECTIVE) return

      // The caption, where one is written
      const caption = node.children.find(isCaption)

      // What the figure shows
      const body = node.children.filter((child) => !isCaption(child))

      // The directive drawn as the figure
      node.data = { ...node.data, hName: 'figure' }

      // A figure with no words under it shows its body alone
      if (caption === undefined || caption.children.length === 0) {
        // Only the body kept
        node.children = body

        // Nothing to draw under it
        return
      }

      // The caption drawn as the figure's caption
      caption.data = { ...caption.data, hName: 'figcaption' }

      // The caption moved under the body
      node.children = [...body, caption]
    })
  }
}
