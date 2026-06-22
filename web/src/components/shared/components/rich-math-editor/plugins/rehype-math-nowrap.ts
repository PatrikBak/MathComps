import type { Element, ElementContent, Root } from 'hast'
import type { Transformer } from 'unified'
import { SKIP, visit } from 'unist-util-visit'

import {
  MATH_NOWRAP_CLASS,
  takeLeadingGlue,
  takeTrailingGlue,
} from '@/components/math/utils/math-nowrap'

/**
 * Reads an element's class tokens as a string array, tolerating hast's
 * `string | number | Array<string | number>` className shape.
 *
 * @param element - The hast element to read classes from.
 * @returns The element's class tokens as strings (empty when it has none).
 */
function classList(element: Element): string[] {
  // className may be absent, a single token, or an array of tokens
  const className = element.properties?.className

  // Array form — stringify each token (the numeric case never occurs for KaTeX)
  if (Array.isArray(className)) {
    return className.map((token) => String(token))
  }

  // Single-string form — split on whitespace
  if (typeof className === 'string') {
    return className.split(/\s+/)
  }

  // No classes present
  return []
}

/**
 * Recognizes the outer wrapper KaTeX emits for inline math (`<span class="katex">`).
 * The inner `.katex` of a display block carries the same token but is excluded by
 * its `.katex-display` parent check at the call site.
 *
 * @param element - The hast element to test.
 * @returns `true` when the element is an inline KaTeX root.
 */
function isInlineKatexRoot(element: Element): boolean {
  // Class list of the candidate span
  const classes = classList(element)

  // Inline math is exactly `.katex`; the block variant adds `.katex-display`
  return classes.includes('katex') && !classes.includes('katex-display')
}

/**
 * Rehype plugin that wraps every inline KaTeX root — together with the
 * punctuation hugging it on either side — in a `white-space: nowrap` span
 * ({@link MATH_NOWRAP_CLASS}).
 *
 * KaTeX lays inline math out inside a `display: inline-block` box (`.katex .base`).
 * An inline-block is an atomic inline, so the browser places a soft-wrap
 * opportunity on both sides of it — which lets a period written right after the
 * formula (`$x$.`), or a bracket written right before it (`($x$`), flow onto its
 * own line. Pulling those whitespace-free runs into a nowrap wrapper keeps them
 * glued to the formula while leaving the surrounding spaces as normal break
 * opportunities.
 *
 * Must run after `rehype-katex` so the `.katex` output exists to wrap.
 *
 * @returns A unified transformer that rewraps inline KaTeX roots in place.
 */
export function rehypeMathNowrap(): Transformer<Root> {
  return (tree) => {
    // Walk every element, wrapping each inline KaTeX root in place
    visit(tree, 'element', (node, index, parent) => {
      // Need a positioned parent to swap the node for its wrapper
      if (!parent || index === undefined) {
        return
      }

      // Only the outer inline KaTeX span gets wrapped
      if (!isInlineKatexRoot(node)) {
        return
      }

      // The inner `.katex` of a display block is already on its own line
      if (parent.type === 'element' && classList(parent).includes('katex-display')) {
        return
      }

      // Idempotency guard — never nest a second wrapper on re-entry
      if (
        parent.type === 'element' &&
        parent.tagName === 'span' &&
        classList(parent).includes(MATH_NOWRAP_CLASS)
      ) {
        return
      }

      // Collect the wrapper's children, pulling in any hugging punctuation
      const wrapped: ElementContent[] = []

      // Pull the trailing run off the previous text sibling (e.g. an opening bracket)
      const previous = parent.children[index - 1]
      if (previous && previous.type === 'text') {
        const { glue, rest } = takeTrailingGlue(previous.value)
        previous.value = rest
        if (glue) {
          wrapped.push({ type: 'text', value: glue })
        }
      }

      // The formula itself sits in the middle
      wrapped.push(node)

      // Pull the leading run off the next text sibling (e.g. a trailing period)
      const next = parent.children[index + 1]
      if (next && next.type === 'text') {
        const { glue, rest } = takeLeadingGlue(next.value)
        next.value = rest
        if (glue) {
          wrapped.push({ type: 'text', value: glue })
        }
      }

      // Swap the bare KaTeX root for the nowrap span holding it and its punctuation
      const wrapper: Element = {
        type: 'element',
        tagName: 'span',
        properties: { className: [MATH_NOWRAP_CLASS] },
        children: wrapped,
      }
      parent.children[index] = wrapper

      // Skip the just-wrapped subtree so the same KaTeX root isn't re-visited
      return SKIP
    })
  }
}
