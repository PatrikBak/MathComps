import type { List } from 'mdast'
import type { ContainerDirective } from 'mdast-util-directive'
import type { Transformer } from 'unified'
import type { Node } from 'unist'
import { visit } from 'unist-util-visit'

/** The seven list-style identifiers accepted by the `style` attribute. */
const ALLOWED_STYLES = [
  'bullet',
  'number-dot',
  'number-parens',
  'lower-roman-parens',
  'upper-roman',
  'lower-alpha-parens',
  'upper-alpha-parens',
] as const

/** A list-style identifier accepted by the `style` attribute. */
type ListStyle = (typeof ALLOWED_STYLES)[number]

/** Set of allowed style identifiers, used for fast `has` checks. */
const ALLOWED_STYLE_SET: ReadonlySet<string> = new Set(ALLOWED_STYLES)

/**
 * Type guard for the `:::list{style=...}` container directive.
 *
 * @param node - The node to test.
 * @returns `true` when the node is a `containerDirective` named `list`.
 */
function isListDirective(node: Node): node is ContainerDirective {
  return node.type === 'containerDirective' && (node as ContainerDirective).name === 'list'
}

/**
 * Type guard for a mdast `list` node — used to locate the inner list that the
 * directive is meant to wrap.
 *
 * @param node - The node to test.
 * @returns `true` when the node is a mdast `list`.
 */
function isMdastList(node: Node): node is List {
  return node.type === 'list'
}

/**
 * Remark plugin that transforms `:::list{style=<style>}` container directives
 * into native `<ol>` or `<ul>` elements with a `list-style-<style>` className.
 * The inner mdast list is unwrapped so the directive renders as the list itself
 * (no extra wrapper), and the className picks the list's markers in CSS.
 *
 * Validation errors are pushed as vfile messages so the headless validator can
 * surface them. The renderer ignores these errors and degrades gracefully.
 *
 * @returns A unified transformer that mutates list directives in-place.
 */
export function remarkListStyle(): Transformer<Node> {
  return (tree, file) => {
    visit(tree, isListDirective, (node: ContainerDirective) => {
      // Pull the validated style from the directive attributes
      const styleAttr = node.attributes?.style
      if (styleAttr === undefined || styleAttr === null) {
        file.message(
          'Missing `style` attribute on :::list directive (expected one of: ' +
            ALLOWED_STYLES.join(', ') +
            ')',
          node
        )
        return
      }

      // Reject unknown style values
      if (!ALLOWED_STYLE_SET.has(styleAttr)) {
        file.message(
          `Unknown list style "${styleAttr}" on :::list directive (expected one of: ` +
            ALLOWED_STYLES.join(', ') +
            ')',
          node
        )
        return
      }

      // Reject any extra attributes besides `style`
      const extraAttrs = Object.keys(node.attributes ?? {}).filter(
        (attrName) => attrName !== 'style'
      )
      if (extraAttrs.length > 0) {
        file.message(`Unknown attribute(s) on :::list directive: ${extraAttrs.join(', ')}`, node)
        return
      }

      // Locate the single inner mdast list (paragraphs/labels are not allowed inside)
      const lists = node.children.filter(isMdastList)
      const nonLists = node.children.filter((child) => !isMdastList(child))

      // Validate that the directive contains exactly one list
      if (lists.length !== 1 || nonLists.length > 0) {
        file.message(
          ':::list directive must contain exactly one markdown list and nothing else',
          node
        )
        return
      }

      // The inner list
      const innerList = lists[0]!

      // A styled list counts from 1 whatever its first item says, so one starting at any other number is reported,
      // and drawn all the same
      if (innerList.ordered && innerList.start !== 1) {
        file.message(
          `A :::list numbers its items from 1, but its first item says ${innerList.start}. ` +
            'Indent the text between items under the item before it, so they stay one list.',
          node
        )
      }

      // The validated style
      const style = styleAttr as ListStyle

      // Set the directive to render as the appropriate native list element
      const data = node.data || (node.data = {})
      data.hName = style !== 'bullet' ? 'ol' : 'ul'
      data.hProperties = { className: `list-style-${style}` }

      // Replace the directive's children with the unwrapped <li> items, which mdast's types allow only under a list
      node.children = innerList.children as unknown as ContainerDirective['children']
    })
  }
}
