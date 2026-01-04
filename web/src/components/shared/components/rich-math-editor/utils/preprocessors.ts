/**
 * Normalizes display math to block format.
 *
 * remark-math requires $$ to be on their own lines for display math,
 * but in LaTeX/TeX, $$...$$ is always display math regardless of newlines.
 * This function ensures all $$...$$ are properly block-formatted.
 *
 * @param content - The markdown content to preprocess
 *
 * @returns The processed content with display math converted to block format
 */
export function preprocessDisplayMath(content: string): string {
  return content.replace(
    /\$\$([\s\S]*?)\$\$/g,
    (_match, mathContent: string) => `\n$$\n${mathContent.trim()}\n$$\n`
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
