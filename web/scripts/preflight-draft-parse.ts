/**
 * Pure parsing helpers for the draft preflight: frontmatter and sentinel
 * splitting, source-line mapping, and image-reference discovery. None of these
 * touch the filesystem, so they are unit-tested directly with inline inputs.
 */

import remarkParse from 'remark-parse'
import { unified } from 'unified'
import { visit } from 'unist-util-visit'
import { parse as parseYaml } from 'yaml'

/** Subfolder holding the draft's image assets. */
export const IMAGES_DIRNAME = 'images'

/** Prefix every disk-resolved image reference carries in the markdown body. */
export const IMAGE_REF_PREFIX = `${IMAGES_DIRNAME}/`

/** HTML-comment line that separates a problem's statement from its solution. */
const SOLUTION_SENTINEL = '<!-- solution -->'

/** A `pN.md` body split away from its frontmatter, tracking where the body begins. */
type FrontmatterSplit = {
  /** Raw YAML text between the `---` fences, or `null` when there is no frontmatter. */
  frontmatterText: string | null
  /** Everything after the closing fence (or the whole file when there is no frontmatter). */
  body: string
  /** 0-based source line index where {@link FrontmatterSplit.body} starts. */
  bodyStartLine0: number
  /** True when an opening `---` fence is never closed. */
  unterminated: boolean
}

/** The typed frontmatter fields the preflight reads off each problem. */
type Frontmatter = {
  /** Author display names, defaulting to an empty list. */
  authors: string[]
  /** External solution URL, or `null` when absent. */
  solutionLink: string | null
}

/** A frontmatter parse outcome — values plus the first structural error, if any. */
type FrontmatterParse = {
  /** Best-effort parsed values (defaults when a field is missing). */
  frontmatter: Frontmatter
  /** First structural problem found, or `null` when the frontmatter is well-formed. */
  error: string | null
}

/** A body split on the solution sentinel, tracking where the solution half begins. */
type SentinelSplit = {
  /** Statement markdown (everything before the sentinel). */
  statement: string
  /** Solution markdown (everything after the sentinel), or `null` when there is no sentinel. */
  solution: string | null
  /** 0-based body-relative line index where the solution half starts, or `null`. */
  solutionBodyLine0: number | null
}

/** Frontmatter values for a problem that declares none. */
const EMPTY_FRONTMATTER: Frontmatter = { authors: [], solutionLink: null }

/** A processor used only to parse markdown into an mdast tree for image discovery. */
const imageRefProcessor = unified().use(remarkParse)

/**
 * Narrows an unknown value to a plain object.
 *
 * @param value - The value to test.
 *
 * @returns `true` when the value is a non-null, non-array object.
 */
export function isRecord(value: unknown): value is Record<string, unknown> {
  // A plain object is a non-null, non-array object
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

/**
 * Extracts a human-readable message from a thrown value.
 *
 * @param error - The caught value.
 *
 * @returns The error's message, or its string form when it is not an Error.
 */
export function asMessage(error: unknown): string {
  // Prefer a real Error's message, falling back to stringifying anything else
  return error instanceof Error ? error.message : String(error)
}

/**
 * Splits a `pN.md` file into its optional YAML frontmatter and its body,
 * remembering the source line the body starts on so error positions can be
 * mapped back to the original file.
 *
 * @param content - The full text of a problem file.
 *
 * @returns The frontmatter text (or `null`), the body, the body's 0-based start
 *   line, and whether an opening fence was left unterminated.
 */
export function splitFrontmatter(content: string): FrontmatterSplit {
  // Work line by line so positions stay in source coordinates
  const lines = content.split('\n')

  // A frontmatter block must open with `---` on the very first line
  if (lines[0]?.trim() !== '---') {
    return { frontmatterText: null, body: content, bodyStartLine0: 0, unterminated: false }
  }

  // The block runs to the next standalone `---`
  const closingIndex = lines.findIndex((line, index) => index > 0 && line.trim() === '---')

  // An opening fence with no close — surface it and treat the whole file as body
  if (closingIndex === -1) {
    return { frontmatterText: null, body: content, bodyStartLine0: 0, unterminated: true }
  }

  // Frontmatter is the lines between the fences; the body picks up after the close
  const frontmatterText = lines.slice(1, closingIndex).join('\n')
  const body = lines.slice(closingIndex + 1).join('\n')
  return { frontmatterText, body, bodyStartLine0: closingIndex + 1, unterminated: false }
}

/**
 * Parses a problem's frontmatter into typed fields, defaulting missing values
 * and reporting the first structural problem rather than throwing.
 *
 * @param frontmatterText - Raw YAML from {@link splitFrontmatter}, or `null`.
 *
 * @returns The parsed {@link Frontmatter} and the first error encountered, if any.
 */
export function parseFrontmatter(frontmatterText: string | null): FrontmatterParse {
  // No frontmatter block at all — everything takes its default
  if (frontmatterText === null || frontmatterText.trim() === '') {
    return { frontmatter: EMPTY_FRONTMATTER, error: null }
  }

  // Reject malformed YAML up front so a syntax error reads clearly
  let parsed: unknown
  try {
    parsed = parseYaml(frontmatterText)
  } catch (error) {
    return {
      frontmatter: EMPTY_FRONTMATTER,
      error: `frontmatter is not valid YAML: ${asMessage(error)}`,
    }
  }

  // An empty document parses to null — treat it as no frontmatter
  if (parsed === null || parsed === undefined) {
    return { frontmatter: EMPTY_FRONTMATTER, error: null }
  }

  // Anything that is not a mapping cannot carry our fields
  if (!isRecord(parsed)) {
    return { frontmatter: EMPTY_FRONTMATTER, error: 'frontmatter must be a mapping of fields' }
  }

  // Authors must be a list of strings when present, otherwise default to empty
  const rawAuthors = parsed.authors
  let authors: string[] = []
  if (rawAuthors !== undefined && rawAuthors !== null) {
    if (!Array.isArray(rawAuthors) || !rawAuthors.every((author) => typeof author === 'string')) {
      return {
        frontmatter: EMPTY_FRONTMATTER,
        error: 'frontmatter "authors" must be a list of strings',
      }
    }
    authors = rawAuthors
  }

  // solutionLink is an optional string
  const rawLink = parsed.solutionLink
  let solutionLink: string | null = null
  if (rawLink !== undefined && rawLink !== null) {
    // Reject a non-string link, keeping the authors parsed so far
    if (typeof rawLink !== 'string') {
      return {
        frontmatter: { authors, solutionLink: null },
        error: 'frontmatter "solutionLink" must be a string',
      }
    }
    solutionLink = rawLink
  }

  // Both fields are well-formed
  return { frontmatter: { authors, solutionLink }, error: null }
}

/**
 * Splits a problem body into its statement and solution halves on the solution
 * sentinel, remembering where the solution half begins.
 *
 * @param body - The problem body (frontmatter already removed).
 *
 * @returns The statement, the solution (or `null` when there is no sentinel),
 *   and the solution half's 0-based body-relative start line.
 */
export function splitOnSentinel(body: string): SentinelSplit {
  // Work line by line so the solution's start line is exact
  const lines = body.split('\n')

  // The sentinel is a standalone comment line; without it the whole body is the statement
  const sentinelIndex = lines.findIndex((line) => line.trim() === SOLUTION_SENTINEL)
  if (sentinelIndex === -1) {
    return { statement: body, solution: null, solutionBodyLine0: null }
  }

  // Statement is everything above the sentinel; solution everything below it
  const statement = lines.slice(0, sentinelIndex).join('\n')
  const solution = lines.slice(sentinelIndex + 1).join('\n')
  return { statement, solution, solutionBodyLine0: sentinelIndex + 1 }
}

/**
 * Maps a half-relative line reported by the markdown validator back to its
 * 1-based line in the original source file.
 *
 * @param halfStartLine0 - 0-based source line index where the half begins.
 * @param relativeLine - 1-based line within the half, or `null` when unknown.
 *
 * @returns The 1-based source line, or `null` when the input position is unknown.
 */
export function toAbsoluteLine(halfStartLine0: number, relativeLine: number | null): number | null {
  // A known position shifts by the half's offset; an unknown one stays unknown
  return relativeLine === null ? null : halfStartLine0 + relativeLine
}

/**
 * Collects the basenames of every `images/…` reference in a markdown string.
 * Parsing to an mdast tree means references inside code spans or fences are
 * ignored, and external (`http(s)`) images are left untouched.
 *
 * @param markdown - The markdown half to scan.
 *
 * @returns Deduplicated image basenames, in first-seen order.
 */
export function collectImageNames(markdown: string): string[] {
  // Parse to a tree so only genuine image nodes are considered
  const tree = imageRefProcessor.parse(markdown)
  const names: string[] = []

  // Only `image` nodes survive parsing, so code-fenced look-alikes never reach here
  visit(tree, 'image', (node) => {
    // Drop any query string or fragment before resolving the on-disk name
    const refPath = node.url.split(/[?#]/)[0] ?? ''

    // Only disk-relative references under images/ are ours to resolve
    if (refPath.startsWith(IMAGE_REF_PREFIX)) {
      const name = refPath.slice(IMAGE_REF_PREFIX.length)
      if (name.length > 0) names.push(name)
    }
  })

  // Dedupe while preserving first-seen order
  return [...new Set(names)]
}
