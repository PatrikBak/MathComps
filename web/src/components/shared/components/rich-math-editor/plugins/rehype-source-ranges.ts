import type { Element, Root } from 'hast'
import type { Transformer } from 'unified'
import { visit } from 'unist-util-visit'

import { dataAttribute } from '@/components/shared/utils/dom-utils'

/** The attribute holding the offset in the written text that a rendered element starts at. */
export const SOURCE_START_ATTRIBUTE = dataAttribute('data-source-start')

/** The attribute holding the offset in the written text that a rendered element ends at. */
export const SOURCE_END_ATTRIBUTE = dataAttribute('data-source-end')

/** The name of an attribute placing a rendered element in the written text. */
type SourceRangeAttributeName =
  | typeof SOURCE_START_ATTRIBUTE.name
  | typeof SOURCE_END_ATTRIBUTE.name

/** Both attributes, for an element with a place in the written text. */
type PlacedSourceRange = Record<SourceRangeAttributeName, string>

/** Neither attribute, for an element with no place in the written text. */
type UnplacedSourceRange = Partial<Record<SourceRangeAttributeName, never>>

/**
 * The attributes placing a rendered element in the written text, both of them or neither.
 */
export type SourceRangeAttributes = PlacedSourceRange | UnplacedSourceRange

/**
 * Options for {@link rehypeSourceRanges}.
 */
export type RehypeSourceRangesOptions = {
  /** Maps an offset in the parsed text to the one it came from in the written text. */
  toSourceOffset: (textOffset: number) => number
}

/**
 * Where an element stands in the parsed text.
 */
type TextRange = {
  /** The offset the element starts at. */
  start: number
  /** The offset the element ends at. */
  end: number
}

/**
 * Where an element stands in the parsed text, as the parser placed it.
 *
 * @param element - An element of the rendered tree.
 * @returns Its range, or null for an element placed nowhere, as a formula is once KaTeX has drawn it.
 */
function parsedRangeOf(element: Element): TextRange | null {
  // Where the parser put the element
  const start = element.position?.start.offset
  const end = element.position?.end.offset

  // An element with no place of its own
  if (start === undefined || end === undefined) return null

  // The element's place
  return { start, end }
}

/**
 * Rehype plugin which stamps each element the parser placed with where it stands in the written text, as
 * {@link SOURCE_START_ATTRIBUTE} and {@link SOURCE_END_ATTRIBUTE}. A top-level block the parser did not place spans
 * the gap between the nearest placed blocks around it. Must run after the sanitizer, which strips the attributes.
 *
 * @param options - The map from the parsed text back to the written one.
 * @returns A unified transformer which stamps the tree's elements.
 */
export function rehypeSourceRanges({
  toSourceOffset,
}: RehypeSourceRangesOptions): Transformer<Root> {
  return (tree, file) => {
    /**
     * A function which stamps an element with a range of the parsed text, as offsets in the written text.
     *
     * @param element - The element to stamp.
     * @param range - Its range in the parsed text.
     */
    const stamp = (element: Element, range: TextRange) =>
      Object.assign(element.properties, {
        ...SOURCE_START_ATTRIBUTE.stamp(String(toSourceOffset(range.start))),
        ...SOURCE_END_ATTRIBUTE.stamp(String(toSourceOffset(range.end))),
      })

    // The blocks the text renders as, in order
    const blocks = tree.children.filter((child): child is Element => child.type === 'element')

    // Where the parser placed each of them
    const parsedRanges = blocks.map(parsedRangeOf)

    // The parsed text's length, where the last gap ends
    const textLength = String(file.value).length

    // Each block stamped by its own range, or by the gap between the placed blocks around it
    blocks.forEach((block, index) =>
      stamp(
        block,
        parsedRanges[index] ?? {
          start: parsedRanges.slice(0, index).findLast((placed) => placed !== null)?.end ?? 0,
          end: parsedRanges.slice(index + 1).find((placed) => placed !== null)?.start ?? textLength,
        }
      )
    )

    // Every element inside the blocks that the parser placed, stamped by its own range
    visit(tree, 'element', (element, _index, parent) => {
      // The blocks themselves are stamped already
      if (parent?.type === 'root') return

      // Where the parser put the element
      const range = parsedRangeOf(element)

      // Stamped where it has a place
      if (range !== null) stamp(element, range)
    })
  }
}

/**
 * The attributes placing a rendered element in the written text, read off the element it was rendered from.
 *
 * @param node - The element of the rendered tree, if any.
 * @returns The attributes, none for an element {@link rehypeSourceRanges} did not stamp.
 */
export function sourceRangeOf(node: Element | undefined): SourceRangeAttributes {
  // The two offsets, where the element carries them
  const start = node?.properties[SOURCE_START_ATTRIBUTE.name]
  const end = node?.properties[SOURCE_END_ATTRIBUTE.name]

  // Both, or nothing
  return typeof start === 'string' && typeof end === 'string'
    ? { [SOURCE_START_ATTRIBUTE.name]: start, [SOURCE_END_ATTRIBUTE.name]: end }
    : {}
}
