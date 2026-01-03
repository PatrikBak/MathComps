import type { ContainerDirective } from 'mdast-util-directive'
import type { Node } from 'unist'
import { visit } from 'unist-util-visit'

/**
 * Node with optional data that may include directive label marker.
 * remark-directive adds `data.directiveLabel = true` to content inside [...].
 */
interface DirectiveLabelNode extends Node {
  data?: {
    directiveLabel?: boolean
    hName?: string
    hProperties?: Record<string, unknown>
  }
  value?: string
  children?: DirectiveLabelNode[]
}

/**
 * Helper to check if a node is part of the [Label] in a directive.
 * remark-directive adds `data.directiveLabel = true` to content inside [...].
 *
 * @param node - The node to check
 *
 * @returns true if the node is part of the [Label] in a directive
 */
function isLabel(node: DirectiveLabelNode): boolean {
  return node.data?.directiveLabel === true
}

/**
 * Gets text content from a node tree recursively.
 * Handles both text nodes and nodes with children.
 *
 * @param node - The node to get text content from
 *
 * @returns The text content of the node
 */
function getTextContent(node: DirectiveLabelNode): string {
  // Handle text nodes
  if (node.type === 'text') {
    return node.value || ''
  }

  // Recursively get text content from nodes with children
  if (node.children) {
    return node.children.map(getTextContent).join('')
  }

  // Return empty string for other node types
  return ''
}

/**
 * Type guard to check if a node is a spoiler container directive.
 *
 * @param node - The node to check
 *
 * @returns true if the node is a spoiler container directive
 */
function isSpoilerDirective(node: Node): node is ContainerDirective {
  return node.type === 'containerDirective' && (node as ContainerDirective).name === 'spoiler'
}

/**
 * Remark plugin to transform :::spoiler[Label] directives into <spoiler> elements.
 *
 * Syntax:
 * ```markdown
 * :::spoiler[My Title]
 * This is the hidden text.
 * :::
 * ```
 *
 * This plugin:
 * 1. Finds all `:::spoiler` container directives
 * 2. Extracts the label text from `[Label]`
 * 3. Transforms the node to render as `<spoiler label="Label">content</spoiler>`
 *
 * @returns A unified transformer function
 */
export function remarkSpoiler() {
  return (tree: Node) => {
    visit(tree, isSpoilerDirective, (node: ContainerDirective) => {
      // Get children as our custom type
      const children = node.children as DirectiveLabelNode[]

      // Find the "Label" content - remark-directive marks [Label] children with directiveLabel
      const labelNodes = children.filter(isLabel)
      const contentNodes = children.filter((node) => !isLabel(node))

      // Extract text from the label nodes (e.g., "My Title")
      // If no label is found, default to 'Skrytý text'
      let labelText = 'Skrytý text'
      if (labelNodes.length > 0) {
        labelText = labelNodes.map(getTextContent).join('').trim() || 'Skrytý text'
      }

      // Transform for Rehype - tell it how to render this node as HTML
      const data = node.data || (node.data = {})

      // Render as <spoiler> element
      data.hName = 'spoiler'

      // Pass the extracted label as an HTML attribute
      data.hProperties = {
        label: labelText,
      }

      // Clean the children - remove label nodes so they don't render inside the box
      node.children = contentNodes as ContainerDirective['children']
    })
  }
}
