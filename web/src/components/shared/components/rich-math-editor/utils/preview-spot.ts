import type { DepthSpan } from '@/components/shared/utils/dom-utils'

/**
 * An element of the rendered preview, by where it stands in the written text and in the preview's scroll.
 */
export type PlacedElement = DepthSpan & {
  /** The offset in the written text the element starts at. */
  start: number
  /** The offset in the written text the element ends at. */
  end: number
  /** The line breaks the element draws, in order, or none for an element holding other placed elements. */
  lineBreaks: DepthSpan[]
}

/**
 * An offset of the written text marked at a depth of the preview.
 */
type Mark = {
  /** The offset in the written text. */
  offset: number
  /** How far down the preview's scrolled content it renders, in px. */
  depth: number
}

/**
 * Merges the elements stamped with one range into one box spanning them all. Every formula of a run of display
 * formulas is stamped with the gap the run stands in, so the run reads as one stretch of text drawn over all of them.
 *
 * @param elements - The preview's placed elements.
 * @returns One element per range.
 */
function mergeSharedRanges(elements: PlacedElement[]): PlacedElement[] {
  // The elements of each range, together
  const groups = Map.groupBy(elements, (element) => `${element.start}:${element.end}`).values()

  // Each range's elements as one box from the highest top to the lowest bottom
  return [...groups].map((group) => ({
    start: group[0].start,
    end: group[0].end,
    top: Math.min(...group.map((element) => element.top)),
    bottom: Math.max(...group.map((element) => element.bottom)),
    lineBreaks: group.length === 1 ? group[0].lineBreaks : [],
  }))
}

/**
 * The marks of one placed element: its text starts at its top and ends at its bottom. Where its line breaks pair one
 * to one with the newlines of its text, each newline also ends its line at its break and starts the next one under it.
 *
 * @param text - The written text.
 * @param element - The placed element.
 * @returns The element's marks.
 */
function marksOf(text: string, element: PlacedElement): Mark[] {
  // The element's own text, from its top to its bottom
  const edges = [
    { offset: element.start, depth: element.top },
    { offset: element.end, depth: element.bottom },
  ]

  // Where each newline of the element's text stands
  const newlines = Array.from(
    text.slice(element.start, element.end).matchAll(/\n/g),
    (newline) => element.start + newline.index
  )

  // Breaks that do not pair with the newlines, as a newline inside a formula draws none, place no lines
  if (newlines.length !== element.lineBreaks.length) return edges

  // Each line ending at its break, and the next one starting under it
  return [
    ...edges,
    ...newlines.flatMap((offset, index) => [
      { offset, depth: element.lineBreaks[index].top },
      { offset: offset + 1, depth: element.lineBreaks[index].bottom },
    ]),
  ]
}

/**
 * How far down a preview's scrolled content an offset of the written text renders. Every placed element marks where
 * its text starts and ends, and its lines where it has them. The offset lands between the nearest marks around it, as
 * far down as it is through the text between them.
 *
 * @param text - The written text.
 * @param elements - The preview's placed elements.
 * @param offset - The offset in the written text.
 * @returns The depth in px, or null for a preview with nothing placed.
 */
export function previewSpotDepth(
  text: string,
  elements: PlacedElement[],
  offset: number
): number | null {
  // Every mark, in the order of the text, and down the preview where two mark one offset
  const marks = mergeSharedRanges(elements)
    .flatMap((element) => marksOf(text, element))
    .sort((first, second) => first.offset - second.offset || first.depth - second.depth)

  // The nearest marks at or before the offset and past it
  const before = marks.findLast((mark) => mark.offset <= offset)
  const after = marks.find((mark) => mark.offset > offset)

  // Before everything, at the first mark, and nowhere in an empty preview
  if (before === undefined) return after?.depth ?? null

  // Past everything, at the last mark
  if (after === undefined) return before.depth

  // How far through the text between the two marks the offset stands, as a share of it
  const through = (offset - before.offset) / (after.offset - before.offset)

  // The same share of the way down from the mark before to the mark after
  return before.depth + through * (after.depth - before.depth)
}
