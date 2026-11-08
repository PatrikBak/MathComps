/** Matches the leading list-item marker on a line (bullet `-`/`*`/`+` or numbered `1.`/`1)`) plus its trailing whitespace. */
const LIST_MARKER_PREFIX_REGEX = /^[ \t]*(?:[-*+]|\d+[.)])[ \t]+/

/**
 * Text with its display math in block format, and the way back from it to the text as written.
 */
export type SourceMappedText = {
  /** The text with its display math in block format. */
  text: string
  /** Maps an offset in {@link SourceMappedText.text} to the one it came from in the text as written. */
  toSourceOffset: (textOffset: number) => number
}

/**
 * One display formula rewritten to block format, by where it stands before and after.
 */
type Rewrite = {
  /** Where the formula starts in the text as written. */
  sourceStart: number
  /** Where the formula ends in the text as written. */
  sourceEnd: number
  /** Where its block starts in the processed text. */
  textStart: number
  /** Where its block ends in the processed text. */
  textEnd: number
}

/**
 * Normalizes display math to block format.
 *
 * remark-math requires $$ to be on their own lines for display math,
 * but in LaTeX/TeX, $$...$$ is always display math regardless of newlines.
 * This function ensures all $$...$$ are properly block-formatted while
 * preserving any leading indentation on the original line — critical for
 * display math nested inside a list item, where CommonMark needs every
 * continuation line indented to match the marker depth.
 *
 * Three indent regimes are handled:
 * - Own-line `$$` with pure-whitespace prefix → preserve that whitespace as indent.
 * - Mid-line `$$` on a line that opens with a list marker (`- `, `1. `, ...) →
 *   indent the emitted block to the post-marker column so the math stays in the item.
 * - Mid-line `$$` anywhere else → no indent.
 *
 * Each rewrite is recorded, so an offset in the processed text maps back to the
 * one it came from in the original.
 *
 * @param content - The markdown content to preprocess
 *
 * @returns The processed content with display math converted to block format,
 * and the map back to the original
 */
export function preprocessDisplayMath(content: string): SourceMappedText {
  // Every formula rewritten, in the order they stand in the text
  const rewrites: Rewrite[] = []

  // The processed text's length minus the original's, up to the formula being rewritten
  let growth = 0

  // The text with every formula rewritten
  const text = content.replace(
    /\$\$([\s\S]*?)\$\$/g,
    (match, mathContent: string, offset: number, source: string) => {
      // Look up what precedes the opening `$$` on its current line (in the original, pre-replacement source)
      const lineStart = offset === 0 ? 0 : source.lastIndexOf('\n', offset - 1) + 1
      const beforeMatch = source.slice(lineStart, offset)

      // Three regimes — see the JSDoc above for the rationale of each
      let indent: string
      if (/^[ \t]*$/.test(beforeMatch)) {
        // `$$` opens its own (possibly indented) line — preserve the whole leading whitespace
        indent = beforeMatch
      } else {
        // Mid-line `$$` — try to detect a list marker on the line so the math doesn't break the item
        const listMarkerMatch = LIST_MARKER_PREFIX_REGEX.exec(beforeMatch)
        indent = listMarkerMatch ? ' '.repeat(listMarkerMatch[0].length) : ''
      }

      // Indent every line of the math body so CommonMark stays inside the enclosing list item.
      // The opening `$$` consumed any leading indent on its own line; multi-line continuation
      // content typically reproduces the list-item indent on every line, so strip it on
      // continuation lines before re-indenting uniformly to avoid double indentation.
      const indentedBody = mathContent
        .trim()
        .split('\n')
        .map((line, lineIndex) => {
          // First line never carried list-item indent in the source — it followed the `$$` directly
          if (lineIndex === 0) return `${indent}${line}`

          // Continuation line — strip the list-item indent if it matches what the source supplied
          const stripped =
            indent.length > 0 && line.startsWith(indent) ? line.slice(indent.length) : line

          // Re-indent
          return `${indent}${stripped}`
        })
        .join('\n')

      // The formula as a block of its own, re-indented as a whole
      const block = `\n${indent}$$\n${indentedBody}\n${indent}$$\n`

      // Where the formula stands in both texts
      rewrites.push({
        sourceStart: offset,
        sourceEnd: offset + match.length,
        textStart: offset + growth,
        textEnd: offset + growth + block.length,
      })

      // The text after the formula shifts by the block's length minus the formula's
      growth += block.length - match.length

      // The formula replaced by its block
      return block
    }
  )

  /**
   * A function which maps an offset in the processed text to the one it came from in the original.
   *
   * @param textOffset - The offset in the processed text.
   * @returns The offset in the original text.
   */
  const toSourceOffset = (textOffset: number) => {
    // The last formula rewritten at or before the offset
    const rewrite = rewrites.findLast((candidate) => candidate.textStart <= textOffset)

    // Before every formula, the two texts agree
    if (rewrite === undefined) return textOffset

    // Past the formula, the text shifted by the rewrites' net change up to its end
    if (textOffset >= rewrite.textEnd) {
      return textOffset - (rewrite.textEnd - rewrite.sourceEnd)
    }

    // Inside the block, as far into the formula as written, never past its end
    return Math.min(rewrite.sourceStart + (textOffset - rewrite.textStart), rewrite.sourceEnd)
  }

  // The processed text, and the way back from it
  return { text, toSourceOffset }
}

/**
 * Collapses excessive `<br>` tags to prevent space-spam abuse.
 * Allows max 2 consecutive breaks (one blank line).
 *
 * @param content - The markdown content to preprocess
 *
 * @returns The processed content with excessive breaks collapsed
 */
export function collapseExcessiveBreaks(content: string): string {
  // Standardize breaks to \n temporarily to safely reduce them
  return content.replace(/<br\s*\/?>/gi, '\n').replace(/\n{3,}/g, '\n\n')
}

/**
 * Applies all markdown preprocessing in the correct order.
 *
 * Order matters:
 * 1. Collapse excessive breaks (prevent space spam)
 * 2. Display math (formats $$ blocks)
 *
 * @param content - The markdown content to preprocess
 *
 * @returns The processed content with breaks collapsed and display math in
 * block format
 */
export function preprocessMarkdown(content: string): string {
  return preprocessDisplayMath(collapseExcessiveBreaks(content)).text
}

/**
 * Checks if content has meaningful text (for form validation).
 * Returns false for empty content, only whitespace, or only `<br>` tags.
 *
 * @param content - The raw user input
 *
 * @returns true if content has meaningful text
 *
 * @example
 * hasValidContent('<br><br>') // false
 * hasValidContent('   ') // false
 * hasValidContent('Hello') // true
 * hasValidContent('<br>Hi<br>') // true
 */
export function hasValidContent(content: string): boolean {
  return (
    content
      // Remove <br> tags
      .replace(/<br\s*\/?>/gi, '')
      // Remove any other HTML tags
      .replace(/<[^>]*>/g, '')
      // Trim whitespace and check if anything remains
      .trim().length > 0
  )
}
