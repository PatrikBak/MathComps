import type { Page } from '@playwright/test'

/** A rendered line whose first visible character should never have been there. */
export type BadLineStart = {
  /** Which of the audited blocks the line sits in. */
  blockIndex: number
  /** The offending character, as it renders. */
  character: string
  /** The prose the line opens with, for placing the failure in the page. */
  excerpt: string
}

/**
 * The characters that must never open a line. A space means prose kept a
 * whitespace the browser should have collapsed at the line's start, and closing
 * punctuation means it broke away from the formula or word it belongs to.
 */
const FORBIDDEN_LINE_STARTS = /[\s,.;:!?)\]}»]/u

/**
 * Finds every rendered line that opens with a character no line may open with.
 * Works off the geometry of individual characters, so it holds whichever
 * renderer produced the markup.
 *
 * A character opens a line when it sits at the left edge of its own line, which the block's line
 * boxes give. Each line is measured on its own, since a block's widest content can begin left of
 * where its prose does. Zero-width characters are ignored, which is what a whitespace the browser
 * correctly collapsed at a line start measures as.
 *
 * @param page The page to audit.
 * @param selector The block-level elements holding the prose, such as paragraphs and list items.
 *   Blocks the reader cannot see are skipped.
 * @returns One entry per offending line, empty when every line opens cleanly.
 */
export async function findBadLineStarts(page: Page, selector: string): Promise<BadLineStart[]> {
  // Text measured before its own font arrives is measured at the wrong width
  await page.evaluate(async () => {
    await document.fonts.ready
  })

  // Every measurement happens in the page, since only geometry can say where a line begins
  return page.evaluate(
    ([blockSelector, forbidden]) => {
      // The pattern arrives as source text, since a regex cannot cross into the page
      const forbiddenPattern = new RegExp(forbidden, 'u')

      // Prose the reader cannot see is laid out at a width nobody reads it at
      const blocks = [...document.querySelectorAll(blockSelector)].filter((element) =>
        element.checkVisibility()
      )

      // Each block is judged on its own, since each has its own left edge
      return blocks.flatMap((element, blockIndex) => {
        // Where each of the block's lines begins, one rect per line box
        const blockRange = document.createRange()
        blockRange.selectNodeContents(element)
        const lineRects = [...blockRange.getClientRects()]

        // A block that laid nothing out has no lines to judge
        if (lineRects.length === 0) return []

        // Walk the block's text, skipping the MathML copy KaTeX hides behind its visual output
        const walker = document.createTreeWalker(element, NodeFilter.SHOW_TEXT, {
          acceptNode: (node) =>
            node.parentElement?.closest('.katex-mathml') === null
              ? NodeFilter.FILTER_ACCEPT
              : NodeFilter.FILTER_REJECT,
        })

        // Only a character that may not open a line is worth placing
        const offenders: BadLineStart[] = []

        // Walk each of the block's own runs of text
        for (let node = walker.nextNode(); node !== null; node = walker.nextNode()) {
          // The run's characters, which an empty node has none of
          const value = node.nodeValue ?? ''

          // Every character in the run is a candidate for opening a line
          for (let offset = 0; offset < value.length; offset++) {
            // The character under the loop
            const character = value[offset]

            // Most characters are free to open a line
            if (!forbiddenPattern.test(character)) continue

            // Measure the single character in place
            const range = document.createRange()
            range.setStart(node, offset)
            range.setEnd(node, offset + 1)
            const rect = range.getBoundingClientRect()

            // A character the browser collapsed away cannot open anything
            if (rect.width === 0) continue

            // The boxes sharing a line with the character, since one line can be several of them
            const lineBoxes = lineRects.filter(
              (lineRect) => rect.top < lineRect.bottom && rect.bottom > lineRect.top
            )

            // A character no line box covers sits nowhere the reader can see
            if (lineBoxes.length === 0) continue

            // Where the character's own line begins
            const lineLeft = Math.min(...lineBoxes.map((lineRect) => lineRect.left))

            // Anything further right than that has something before it on its line
            if (rect.left - lineLeft >= 1.5) continue

            // It opens a line it may not, so record enough to find it in the page
            offenders.push({
              blockIndex,
              character,
              excerpt: value.slice(offset, offset + 40),
            })
          }
        }

        // Whatever this block turned up, which is usually nothing
        return offenders
      })
    },
    [selector, FORBIDDEN_LINE_STARTS.source] as const
  )
}
