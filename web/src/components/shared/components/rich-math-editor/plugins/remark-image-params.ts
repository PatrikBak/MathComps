import type { Transformer } from 'unified'
import type { Node } from 'unist'
import { visit } from 'unist-util-visit'

import { parseImageUrl } from '../utils/image-url-params'

/** Minimal shape of an mdast `image` node — only the bits this plugin reads. */
type MdastImage = Node & {
  /** Always 'image' */
  type: 'image'
  /** The image URL (possibly with query parameters) */
  url: string
}

/**
 * Type guard for an mdast `image` node.
 *
 * @param node - The node to test.
 * @returns `true` when the node is an mdast `image`.
 */
function isImageNode(node: Node): node is MdastImage {
  return node.type === 'image'
}

/**
 * Remark plugin that validates the recognised query parameters on image URLs.
 * Errors are reported via vfile messages; the AST itself is left untouched.
 *
 * @returns A unified transformer that scans every image URL for invalid params.
 */
export function remarkImageParams(): Transformer<Node> {
  return (tree, file) => {
    visit(tree, isImageNode, (node: MdastImage) => {
      // Skip images without a URL — sanitize/validation will reject those upstream
      if (!node.url) {
        return
      }

      // Surface every error from the shared parser as a separate vfile message
      const { errors } = parseImageUrl(node.url)
      for (const error of errors) {
        file.message(error.message, node)
      }
    })
  }
}
