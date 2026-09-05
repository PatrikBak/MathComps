import type { Element, ElementContent, Root } from 'hast'
import type { Transformer } from 'unified'
import { SKIP, visit } from 'unist-util-visit'

import type { MathGlueReader, MathGlueResult } from '@/components/math/utils/math-nowrap'
import { MATH_NOWRAP_CLASS, planMathGlue } from '@/components/math/utils/math-nowrap'
import { assertNever } from '@/components/shared/utils/assert-never'

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
 * Recognizes the outer wrapper KaTeX emits for inline math (`<span class="katex">`). The inner
 * `.katex` of a display block carries the same token, and is told apart by the `.katex-display`
 * wrapper around it.
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

/** The elements {@link MathGlueReader.isWrapper} holds for, in hast's vocabulary. */
const GLUE_WRAPPER_TAGS = ['strong', 'em']

/** Answers the glue pass's questions about a rendered element's children. */
const HAST_GLUE_READER: MathGlueReader<ElementContent, Element, Element> = {
  isInlineMath: (node): node is Element => node.type === 'element' && isInlineKatexRoot(node),
  readText: (node) => (node.type === 'text' ? node.value : null),
  isWrapper: (node): node is Element =>
    node.type === 'element' && GLUE_WRAPPER_TAGS.includes(node.tagName),
  readChildren: (wrapper) => wrapper.children,
}

/**
 * Whether a planned run holds a formula anywhere in it, nested runs included.
 *
 * @param results The planned run to look through.
 * @returns True when at least one formula sits somewhere in the run.
 */
function holdsMath(results: MathGlueResult<ElementContent, Element, Element>[]): boolean {
  // A formula at this level answers it, and so does one inside a run at this level
  return results.some(
    (result) => result.kind === 'glued' || (result.kind === 'wrapper' && holdsMath(result.children))
  )
}

/**
 * Turns one planned child back into hast, wrapping a formula and the punctuation
 * it claimed in a `white-space: nowrap` span ({@link MATH_NOWRAP_CLASS}).
 *
 * @param result The planned child to rebuild.
 * @returns The node to put back in the parent's child list.
 */
function toChild(result: MathGlueResult<ElementContent, Element, Element>): ElementContent {
  switch (result.kind) {
    // A child no formula touched goes back as it was
    case 'unchanged':
      return result.node
    // Text goes back as whatever a neighbouring formula left of it
    case 'trimmed':
      return { type: 'text', value: result.text }
    // A walked run keeps its own element and takes back the children the pass planned
    case 'wrapper':
      return { ...result.node, children: result.children.map(toChild) }
    case 'glued': {
      // The formula itself, which the runs it claimed then sit either side of
      const children: ElementContent[] = [result.math]

      // A run claimed off the preceding prose goes in front of it
      if (result.glue.leading) {
        children.unshift({ type: 'text', value: result.glue.leading })
      }

      // A run claimed off the following prose goes behind it
      if (result.glue.trailing) {
        children.push({ type: 'text', value: result.glue.trailing })
      }

      // The span that holds the lot together on one line
      return {
        type: 'element',
        tagName: 'span',
        properties: { className: [MATH_NOWRAP_CLASS] },
        children,
      }
    }
    default:
      return assertNever(result)
  }
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
 * Formulas are read off their parent element's child list, which is where markdown puts them:
 * prose lands in a block element long before KaTeX runs. A formula written inside a bold or italic
 * run reaches out of it for the punctuation written after the run.
 *
 * Must run after `rehype-katex` so the `.katex` output exists to wrap.
 *
 * @returns A unified transformer that rewraps inline KaTeX roots in place.
 */
export function rehypeMathNowrap(): Transformer<Root> {
  return (tree) => {
    // Walk every element, gluing the inline formulas among its own children
    visit(tree, 'element', (element) => {
      // The element's own class tokens
      const classes = classList(element)

      // The inner `.katex` of a display block is already on its own line
      if (classes.includes('katex-display')) {
        return SKIP
      }

      // Idempotency guard — never nest a second wrapper on re-entry
      if (classes.includes(MATH_NOWRAP_CLASS)) {
        return SKIP
      }

      // Work out what each inline formula among the children has to hold on to
      const results = planMathGlue(element.children, HAST_GLUE_READER)

      // Leave the element alone when no formula sits anywhere among its children
      if (!holdsMath(results)) {
        return
      }

      // Swap in the rebuilt children, each formula now inside its nowrap span
      element.children = results.map(toChild)
    })
  }
}
