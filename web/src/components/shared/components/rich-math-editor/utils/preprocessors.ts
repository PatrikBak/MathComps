/** Matches the leading list-item marker on a line (bullet `-`/`*`/`+` or numbered `1.`/`1)`) plus its trailing whitespace. */
const LIST_MARKER_PREFIX_REGEX = /^[ \t]*(?:[-*+]|\d+[.)])[ \t]+/

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
 * - Mid-line `$$` anywhere else → no indent (legacy behavior).
 *
 * @param content - The markdown content to preprocess
 *
 * @returns The processed content with display math converted to block format
 */
export function preprocessDisplayMath(content: string): string {
  return content.replace(
    /\$\$([\s\S]*?)\$\$/g,
    (_match, mathContent: string, offset: number, source: string) => {
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

      // Re-indent the entire block
      return `\n${indent}$$\n${indentedBody}\n${indent}$$\n`
    }
  )
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
 * @returns The processed content with display math converted to HTML
 */
export function preprocessMarkdown(content: string): string {
  return preprocessDisplayMath(collapseExcessiveBreaks(content))
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
