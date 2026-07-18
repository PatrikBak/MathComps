import { assertNever } from '@/components/shared/utils/assert-never'

import type { ListStyleType, RawContentBlock } from './handout-content-types'

/**
 * Flattens a handout content sequence back to markdown/math source. Figures and footnotes are
 * dropped, since the flattened text carries the mathematics, not the layout.
 *
 * @param blocks - The content sequence to flatten.
 *
 * @returns The reconstructed markdown/math source.
 */
export function blockSequenceToMarkdown(blocks: RawContentBlock[]): string {
  // Flatten every block, then collapse runs of blank lines the block separators introduce
  return blocks
    .map((block) => blockToMarkdown(block))
    .join('')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}

/**
 * Where a block sits while flattening, which decides how display math is emitted: a standalone block
 * at the top level, or kept on the item's line inside a list so it doesn't split the list.
 */
type FlattenContext = 'block' | 'listItem'

/**
 * The `:::list{style=…}` directive token for each list style, matching the renderer's accepted
 * tokens, so a lettered / roman / parenthesized list keeps its markers through the round-trip.
 */
const LIST_STYLE_TOKENS: Record<ListStyleType, string> = {
  Bullet: 'bullet',
  NumberDot: 'number-dot',
  NumberParens: 'number-parens',
  LowerRomanParens: 'lower-roman-parens',
  UpperRoman: 'upper-roman',
  LowerAlphaParens: 'lower-alpha-parens',
  UpperAlphaParens: 'upper-alpha-parens',
}

/**
 * Flattens a run of inline content to a single markdown/math string.
 *
 * @param content - The inline content blocks.
 * @param context - Where the surrounding block sits, threaded so nested display math emits right.
 *
 * @returns The concatenated markdown/math source.
 */
function flattenInline(content: RawContentBlock[], context: FlattenContext): string {
  // Flatten each inner block in the same context and concatenate
  return content.map((inner) => blockToMarkdown(inner, context)).join('')
}

/**
 * Indents every line of a list item's body except the first by the given width, so a nested list or
 * other continuation block sits at the item's content column and CommonMark reads it as part of the
 * item rather than a sibling.
 *
 * @param body - The item body to indent.
 * @param width - The number of spaces to indent continuation lines by (the marker's width).
 *
 * @returns The body with its continuation lines hung under the marker.
 */
function indentContinuation(body: string, width: number): string {
  // The continuation indent, matching the item's marker width
  const pad = ' '.repeat(width)

  // Keep the first line flush and push every continuation line to the content column
  return body
    .split('\n')
    .map((line, index) => (index === 0 ? line : `${pad}${line}`))
    .join('\n')
}

/**
 * Selects a block's rendering by where it sits. Keyed by every {@link FlattenContext}, so a new
 * context is a compile error at each call site rather than silently taking one branch.
 *
 * @param context - Where the block sits.
 * @param byContext - The rendering for each context.
 *
 * @returns The rendering for the given context.
 */
function renderForContext(
  context: FlattenContext,
  byContext: Record<FlattenContext, string>
): string {
  // The rendering registered for this context
  return byContext[context]
}

/**
 * The markdown list marker for a style: a numbered marker for every ordered variant, a dash for
 * bullets. The visible glyph (a), (i), 1., …) is painted from the style directive, so the source
 * only carries the plain ordered / bullet marker.
 *
 * @param style - The list's style.
 * @param index - The item's zero-based position.
 *
 * @returns The markdown marker prefix for the item, trailing space included.
 */
function listMarker(style: ListStyleType, index: number): string {
  switch (style) {
    // Every ordered variant collapses to a plain markdown ordered item
    case 'NumberDot':
    case 'NumberParens':
    case 'UpperRoman':
    case 'LowerRomanParens':
    case 'LowerAlphaParens':
    case 'UpperAlphaParens':
      return `${index + 1}. `
    // Bullets stay bullets
    case 'Bullet':
      return '- '
    default:
      return assertNever(style)
  }
}

/**
 * Flattens one content block to markdown/math source.
 *
 * @param block - The content block to flatten.
 * @param context - Where the block sits, which decides how display math is emitted.
 *
 * @returns The block's markdown/math source.
 */
function blockToMarkdown(block: RawContentBlock, context: FlattenContext = 'block'): string {
  switch (block.type) {
    // Plain text passes through
    case 'text':
      return block.text
    case 'math':
      // Inline math stays inline
      if (!block.isDisplay) {
        return `$${block.text}$`
      }
      // Display math inside a list item rides on the item's line so the renderer keeps it in the
      // item; anywhere else it stands alone as its own block
      return renderForContext(context, {
        block: `\n\n$$${block.text}$$\n\n`,
        listItem: ` $$${block.text}$$`,
      })
    // A paragraph is a block on its own, but inside a list item it's the item's inline content, so
    // it must not inject the blank lines that would break the item out of its list. It leads with a
    // space so a paragraph following a sibling block on the item's line doesn't glue onto it; the
    // item strips that space back off when the paragraph opens the line
    case 'paragraph': {
      const inline = flattenInline(block.content, context)
      return renderForContext(context, { block: `\n\n${inline}\n\n`, listItem: ` ${inline}` })
    }
    // Bold / italic wrap their inline content in markdown emphasis
    case 'bold':
      return `**${flattenInline(block.content, context)}**`
    case 'italic':
      return `*${flattenInline(block.content, context)}*`
    // A link is markdown link syntax around its content
    case 'link':
      return `[${flattenInline(block.content, context)}](${block.url})`
    // A quote is inline in handouts (locale-aware quotation marks, italic); keep it inline here too
    case 'quote':
      return `*"${flattenInline(block.content, context)}"*`
    // A list becomes one markdown line per item, flattened in list-item context
    case 'list': {
      // One line per item; each item's continuation lines (a nested list or following block) are
      // indented to the item's content column so nesting survives even under double-digit markers
      const items = block.items
        .map((item, index) => {
          // The ordered / bullet marker; the visible glyph (a), (i), 1., ...) is CSS-painted
          const marker = listMarker(block.styleType, index)

          // The item's flattened content, minus any trailing newline a nested sub-list leaves so the
          // item doesn't end on a blank continuation line, and minus the leading space a paragraph
          // opening the item carries to separate itself from a preceding sibling
          const body = flattenInline(item, 'listItem').replace(/\n+$/, '').replace(/^ +/, '')

          // Marker plus body, its continuation lines hung under the marker
          return `${marker}${indentContinuation(body, marker.length)}`
        })
        .join('\n')

      // A list nested inside a parent item rides as an indented plain sub-list, opened and closed by a
      // newline so a following block in the same item sits on its own line rather than gluing onto the
      // last sub-item; the parent hangs these lines under its marker. The style directive would close
      // the parent list, so a nested list keeps the default markers. At the top level it's wrapped in
      // that directive so the original marker style survives the round-trip to markdown
      return renderForContext(context, {
        block: `\n\n:::list{style=${LIST_STYLE_TOKENS[block.styleType]}}\n${items}\n:::\n\n`,
        listItem: `\n${items}\n`,
      })
    }
    // Figures have no text to flatten
    case 'image':
      return ''
    // Footnotes are dropped
    case 'footnote':
      return ''
    default:
      return assertNever(block)
  }
}
