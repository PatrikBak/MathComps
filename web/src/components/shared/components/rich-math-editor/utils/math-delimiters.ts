/**
 * Math-delimiter balance check for markdown+TeX. `remark-math` pairs `$`
 * greedily left-to-right, so a single missing `$` degrades the leftover lone
 * delimiter to a literal dollar and silently re-pairs everything downstream —
 * no KaTeX error fires. Counting unescaped `$` outside code and flagging an odd
 * total catches that missing delimiter, which in CS/SK math text (where a
 * literal `$` is ~never intended) is high-signal.
 */

import remarkParse from 'remark-parse'
import { unified } from 'unified'
import { visit } from 'unist-util-visit'

/** A plain markdown parser — no math plugin, so `$` stays as ordinary text. */
const markdownProcessor = unified().use(remarkParse)

/**
 * Counts the unescaped `$` characters in a raw text slice — a `$` preceded by an
 * even number of consecutive backslashes is unescaped, an odd number means it
 * was escaped as `\$` and is a literal dollar that must not count.
 *
 * @param slice - A raw source slice (escape backslashes intact).
 *
 * @returns The number of unescaped `$` in the slice.
 */
function countUnescapedDollars(slice: string): number {
  let count = 0

  // Track the run of backslashes immediately before the current character
  let backslashRun = 0
  for (const char of slice) {
    if (char === '\\') {
      // Grow the pending escape run
      backslashRun += 1
    } else {
      // A `$` counts only when an even number of backslashes precede it
      if (char === '$' && backslashRun % 2 === 0) count += 1

      // Any non-backslash ends the run
      backslashRun = 0
    }
  }

  return count
}

/**
 * Reports whether a markdown string has an odd number of unescaped `$` math
 * delimiters outside of code, which means a delimiter is missing or unmatched.
 *
 * Parsing to an mdast tree and visiting only `text` nodes drops `$` inside
 * inline code (`` `…` ``) and fenced code, where a dollar is literal. Each text
 * node is re-sliced from the raw source by its position offsets so escape
 * backslashes — which the parser strips from the node value — are still visible.
 *
 * Catches a *missing* delimiter (odd count), not a *misplaced-but-even* one.
 *
 * @param markdown - The markdown+TeX string to check.
 *
 * @returns `true` when the unescaped-`$` count is odd.
 */
export function hasUnbalancedDollars(markdown: string): boolean {
  // Parse so only genuine text nodes — never code — are inspected
  const tree = markdownProcessor.parse(markdown)
  let total = 0

  // Sum unescaped `$` across every text node, read from the raw source to keep escapes
  visit(tree, 'text', (node) => {
    // Synthetic nodes without positions never occur from a parse, but guard rather than assume offsets
    const start = node.position?.start.offset
    const end = node.position?.end.offset
    if (start === undefined || end === undefined) return

    // Accumulate dollars from the current slice
    total += countUnescapedDollars(markdown.slice(start, end))
  })

  // An odd total means one delimiter has no partner
  return total % 2 === 1
}
