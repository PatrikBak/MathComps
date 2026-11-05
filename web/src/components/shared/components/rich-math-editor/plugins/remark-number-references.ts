import type { Data, PhrasingContent, Root, Text } from 'mdast'
import type { Transformer } from 'unified'
import { SKIP, visit } from 'unist-util-visit'

/** The element a `#N` in the text becomes. */
export const NUMBER_REFERENCE_TAG = 'number-ref'

/** The property of a {@link NUMBER_REFERENCE_TAG} element holding the number it names. */
export const NUMBER_REFERENCE_NUMBER = 'dataNumber'

/** A `#` and a number, which a letter or digit straight after it makes part of a longer word. */
const NUMBER_REFERENCE_PATTERN = /#(\d+)(?![\p{L}\p{N}_])/gu

/**
 * A `#N` in the text, drawn as a {@link NUMBER_REFERENCE_TAG} element holding the `#N` as its text.
 */
type NumberReference = {
  /** The node's kind. */
  type: 'numberReference'
  /** The element it is drawn as, and the number it names. */
  data: Data
  /** The `#N` as written. */
  children: [Text]
}

declare module 'mdast' {
  /** The kinds of inline node, a `#N` among them. */
  interface PhrasingContentMap {
    /** A `#N` in the text. */
    numberReference: NumberReference
  }
}

/**
 * Remark plugin which turns each `#N` in a text into a {@link NUMBER_REFERENCE_TAG} element naming N. Only plain
 * text is read, so math and code keep theirs, and so does the text of a link.
 *
 * @returns A unified transformer which cuts every text at its references.
 */
export function remarkNumberReferences(): Transformer<Root> {
  return (tree) => {
    visit(tree, (node, index, parent) => {
      // A link's text names where it leads, so its numbers stay as they are
      if (node.type === 'link' || node.type === 'linkReference') return SKIP

      // Only plain text holds references
      if (node.type !== 'text' || parent === undefined || index === undefined) return

      // The text cut at each reference
      const pieces = splitAtReferences(node.value)

      // A text with no reference stays as it is
      if (!pieces.some((piece) => piece.type === 'numberReference')) return

      // The inline content holding the text
      const siblings = parent.children as PhrasingContent[]

      // The text swapped for its pieces
      siblings.splice(index, 1, ...pieces)

      // The walk going on past the pieces, which hold nothing more to cut
      return [SKIP, index + pieces.length]
    })
  }
}

/**
 * Cuts a text at each `#N` it holds.
 *
 * @param value - The text.
 *
 * @returns The stretches of text around the references, and the references in place, in the text's order; the text
 *   alone when it holds none.
 */
function splitAtReferences(value: string): PhrasingContent[] {
  // Every reference in the text
  const matches = [...value.matchAll(NUMBER_REFERENCE_PATTERN)]

  // Each reference after the text since the previous one
  const pieces = matches.flatMap((match, position): PhrasingContent[] => {
    // Where the text before the reference starts, which is where the previous reference ends
    const previous = matches[position - 1]
    const start = previous === undefined ? 0 : previous.index + previous[0].length

    // The text before the reference, then the reference
    return [{ type: 'text', value: value.slice(start, match.index) }, referenceTo(match)]
  })

  // Where the text after the last reference starts
  const last = matches.at(-1)
  const tailStart = last === undefined ? 0 : last.index + last[0].length

  // The pieces, the text after the last reference closing them, with no empty text among them
  return [...pieces, { type: 'text', value: value.slice(tailStart) } satisfies Text].filter(
    (piece) => piece.type !== 'text' || piece.value !== ''
  )
}

/**
 * The reference a `#N` found in a text is.
 *
 * @param match - The `#N`, the number caught alone.
 *
 * @returns The reference, holding the `#N` as written.
 */
function referenceTo(match: RegExpExecArray): NumberReference {
  // The `#N` as written, naming its number
  return {
    type: 'numberReference',
    data: {
      hName: NUMBER_REFERENCE_TAG,
      hProperties: { [NUMBER_REFERENCE_NUMBER]: Number(match[1]) },
    },
    children: [{ type: 'text', value: match[0] }],
  }
}
