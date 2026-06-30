/**
 * Building blocks for constrained MDX component maps that allow only paragraphs and inline elements:
 * a thrower for block-level elements plus the block-element map, so a caller only has to declare its
 * own styled inline elements.
 */

/**
 * Throws for an MDX element that isn't allowed in constrained card content.
 *
 * @param element - The disallowed element's tag name.
 * @param context - Where it appeared, for the message (e.g. `"news card content"`).
 *
 * @returns Never — always throws.
 */
function disallowedElement(element: string, context: string): never {
  // Fail loudly so unsupported markup can't ship
  throw new Error(
    `<${element}> is not allowed in ${context}. ` +
      `Only paragraphs and inline elements (links, bold, italic, code) are supported.`
  )
}

/** The block-level MDX tags rejected in constrained card content. */
const DISALLOWED_BLOCK_TAGS = [
  'h1',
  'h2',
  'h3',
  'ul',
  'ol',
  'blockquote',
  'pre',
  'hr',
  'table',
  'img',
] as const

/**
 * Builds the components map that rejects every block-level tag, each wired to {@link disallowedElement}.
 *
 * @param context - Where the content appears, for the error messages (e.g. `"guide card content"`).
 *
 * @returns A map keyed by block tag, each a throwing component.
 */
export function disallowedBlockComponents(context: string): Record<string, () => never> {
  // One throwing component per block tag
  return Object.fromEntries(
    DISALLOWED_BLOCK_TAGS.map((tag) => [tag, () => disallowedElement(tag, context)])
  )
}
