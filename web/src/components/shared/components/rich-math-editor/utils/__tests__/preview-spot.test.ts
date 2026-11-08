import { describe, expect, it } from 'vitest'

import { type PlacedElement, previewSpotDepth } from '../preview-spot'

/** A text of three paragraphs after a blank line, the second of two lines. */
const TEXT = '\nFirst\n\nAlpha\nBeta gamma\n\nLast\n'

/** The three paragraphs, the second's line after its break drawn tall, as an image on it would make it. */
const PARAGRAPHS: PlacedElement[] = [
  { start: 1, end: 6, top: 0, bottom: 20, lineBreaks: [] },
  { start: 8, end: 24, top: 30, bottom: 130, lineBreaks: [{ top: 30, bottom: 50 }] },
  { start: 26, end: 30, top: 140, bottom: 160, lineBreaks: [] },
]

describe('previewSpotDepth', () => {
  it.each([
    ['halfway through the tall line, halfway down it', 19, 90],
    ['at the end of a line, at its break', 13, 30],
    ['at the start of a line, under the break before it', 14, 50],
    ['in the blank line between two paragraphs, between them', 7, 25],
    ['before every paragraph, at the top of the first', 0, 0],
    ['past every paragraph, at the bottom of the last', 31, 160],
  ])('places an offset %s', (_description, offset, depth) => {
    // The offset's spot
    const spot = previewSpotDepth(TEXT, PARAGRAPHS, offset)

    // At the expected depth
    expect(spot).toBe(depth)
  })

  it('spreads a paragraph whose breaks do not pair with its newlines evenly over it', () => {
    // The paragraphs with no breaks read, as for elements holding other placed elements
    const paragraphs = PARAGRAPHS.map((paragraph) => ({ ...paragraph, lineBreaks: [] }))

    // A spot in the second paragraph's second line
    const spot = previewSpotDepth(TEXT, paragraphs, 19)

    // As far down the paragraph as the offset is through its text
    expect(spot).toBe(30 + (11 / 16) * 100)
  })

  it('places an offset in a run of elements sharing one range across all of them', () => {
    // Two paragraphs, and between them three formulas stamped with the gap they stand in
    const elements: PlacedElement[] = [
      { start: 0, end: 4, top: 0, bottom: 10, lineBreaks: [] },
      { start: 4, end: 34, top: 20, bottom: 40, lineBreaks: [] },
      { start: 4, end: 34, top: 50, bottom: 70, lineBreaks: [] },
      { start: 4, end: 34, top: 80, bottom: 100, lineBreaks: [] },
      { start: 34, end: 38, top: 110, bottom: 120, lineBreaks: [] },
    ]

    // A spot near the end of the run's text
    const spot = previewSpotDepth('x'.repeat(38), elements, 31)

    // In the last formula
    expect(spot).toBe(20 + (27 / 30) * 80)
  })

  it('places nothing in a preview with nothing placed', () => {
    // The spot in an empty preview
    const spot = previewSpotDepth('', [], 0)

    // Nowhere
    expect(spot).toBeNull()
  })
})
