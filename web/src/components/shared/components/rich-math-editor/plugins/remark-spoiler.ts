import type { ContainerDirective } from 'mdast-util-directive'
import type { Transformer } from 'unified'
import type { Node } from 'unist'
import { visit } from 'unist-util-visit'

/** Loose mdast node shape carrying the directive-label marker and rehype render hints. */
type DirectiveLabelNode = Node & {
  /** remark-directive marker on `[Label]` children plus rehype render hints */
  data?: {
    /** Set by remark-directive on children inside `[...]` */
    directiveLabel?: boolean
    /** Element name for rehype to render */
    hName?: string
    /** HTML attributes for rehype to render */
    hProperties?: Record<string, unknown>
  }
  /** Text node value when `type === 'text'` */
  value?: string
  /** Child nodes when this is a parent */
  children?: DirectiveLabelNode[]
}

/**
 * Type guard for a directive-label node — content inside `[...]` that
 * remark-directive tags with `data.directiveLabel === true`.
 *
 * @param node - The node to test.
 * @returns `true` when the node is a directive-label child.
 */
function isLabel(node: DirectiveLabelNode): boolean {
  return node.data?.directiveLabel === true
}

/**
 * Recursively concatenates text content from a mdast subtree.
 *
 * @param node - The root of the subtree to walk.
 * @returns The flattened text content.
 */
function getTextContent(node: DirectiveLabelNode): string {
  // Text leaf — return its value
  if (node.type === 'text') {
    return node.value || ''
  }

  // Parent — recurse into children and concatenate
  if (node.children) {
    return node.children.map(getTextContent).join('')
  }

  // Other node types contribute no text
  return ''
}

/**
 * Type guard for the `:::spoiler` container directive.
 *
 * @param node - The node to test.
 * @returns `true` when the node is a `containerDirective` named `spoiler`.
 */
function isSpoilerDirective(node: Node): node is ContainerDirective {
  return node.type === 'containerDirective' && (node as ContainerDirective).name === 'spoiler'
}

/**
 * Remark plugin that transforms `:::spoiler[Label]` container directives into
 * `<spoiler label="Label">content</spoiler>` elements.
 *
 * @returns A unified transformer that mutates spoiler directives in-place.
 */
export function remarkSpoiler(): Transformer<Node> {
  return (tree) => {
    visit(tree, isSpoilerDirective, (node: ContainerDirective) => {
      // Cast directive children to our loose label-aware shape
      const children = node.children as DirectiveLabelNode[]

      // Split into label nodes (the `[Label]`) and the body content
      const labelNodes = children.filter(isLabel)
      const contentNodes = children.filter((child) => !isLabel(child))

      // Extract label text from the `[Label]` children; the renderer falls
      // back to a translated default when missing or empty
      let labelText: string | undefined
      if (labelNodes.length > 0) {
        const extracted = labelNodes.map(getTextContent).join('').trim()
        if (extracted) {
          labelText = extracted
        }
      }

      // Set the directive to render as `<spoiler label="...">`
      const data = node.data || (node.data = {})
      data.hName = 'spoiler'
      data.hProperties = { label: labelText }

      // Strip the label nodes from the children so they don't render inside the body
      node.children = contentNodes as ContainerDirective['children']
    })
  }
}
