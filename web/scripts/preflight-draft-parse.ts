/**
 * Pure parsing helpers for the draft preflight: per-problem metadata narrowing,
 * solution-sentinel splitting, source-line mapping, and image-reference
 * discovery. None of these touch the filesystem, so they are unit-tested
 * directly with inline inputs.
 */

import remarkParse from 'remark-parse'
import { unified } from 'unified'
import { visit } from 'unist-util-visit'
import { parse as parseYaml } from 'yaml'

/** Subfolder holding the draft's image assets. */
export const IMAGES_DIRNAME = 'images'

/** Prefix every disk-resolved image reference carries in the markdown body. */
export const IMAGE_REF_PREFIX = `${IMAGES_DIRNAME}/`

/** Image formats the pipeline can size and serve — SVG plus the supported raster formats. */
export const SUPPORTED_IMAGE_EXTENSIONS = ['.svg', '.png', '.jpg', '.jpeg', '.webp']

/** Per-image size ceiling (MB): figures serve unoptimized, so a multi-megabyte scan would ship at full weight. */
export const MAX_IMAGE_MB = 2

/** HTML-comment line that separates a problem's statement from its solution. */
const SOLUTION_SENTINEL = '<!-- solution -->'

/** The typed metadata fields the preflight reads off each problem's `pN.yaml`. */
type ProblemMeta = {
  /** Author display names, defaulting to an empty list. */
  authors: string[]
  /** External solution URL, or `null` when absent. */
  solutionLink: string | null
}

/** A problem-metadata parse outcome — values plus the first structural error, if any. */
type ProblemMetaParse = {
  /** Best-effort parsed values (defaults when a field is missing). */
  meta: ProblemMeta
  /** First structural problem found, or `null` when the metadata is well-formed. */
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

/** Metadata values for a problem whose `pN.yaml` declares none. */
const EMPTY_PROBLEM_META: ProblemMeta = { authors: [], solutionLink: null }

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
 * Reports whether a body file opens with a `---` frontmatter fence. Bodies are
 * content-only — their metadata lives in the sibling `pN.yaml` — so a leading
 * fence is a mistake the preflight flags.
 *
 * @param content - The full text of a body file.
 *
 * @returns `true` when the first line is a standalone `---`.
 */
export function hasLeadingFrontmatter(content: string): boolean {
  // A frontmatter block would open with `---` on the very first line
  return content.split('\n', 1)[0]?.trim() === '---'
}

/**
 * Parses a problem's `pN.yaml` metadata into typed fields, defaulting missing
 * values and reporting the first structural problem rather than throwing.
 *
 * @param yamlText - The raw contents of the `pN.yaml` file.
 *
 * @returns The parsed {@link ProblemMeta} and the first error encountered, if any.
 */
export function parseProblemMeta(yamlText: string): ProblemMetaParse {
  // An empty file declares nothing — everything takes its default
  if (yamlText.trim() === '') {
    return { meta: EMPTY_PROBLEM_META, error: null }
  }

  // Reject malformed YAML up front so a syntax error reads clearly
  let parsed: unknown
  try {
    parsed = parseYaml(yamlText)
  } catch (error) {
    return {
      meta: EMPTY_PROBLEM_META,
      error: `metadata is not valid YAML: ${asMessage(error)}`,
    }
  }

  // An empty document parses to null — treat it as no metadata
  if (parsed === null || parsed === undefined) {
    return { meta: EMPTY_PROBLEM_META, error: null }
  }

  // Anything that is not a mapping cannot carry our fields
  if (!isRecord(parsed)) {
    return { meta: EMPTY_PROBLEM_META, error: 'metadata must be a mapping of fields' }
  }

  // Authors must be a list of strings when present, otherwise default to empty
  const rawAuthors = parsed.authors
  let authors: string[] = []
  if (rawAuthors !== undefined && rawAuthors !== null) {
    if (!Array.isArray(rawAuthors) || !rawAuthors.every((author) => typeof author === 'string')) {
      return {
        meta: EMPTY_PROBLEM_META,
        error: 'metadata "authors" must be a list of strings',
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
        meta: { authors, solutionLink: null },
        error: 'metadata "solutionLink" must be a string',
      }
    }
    solutionLink = rawLink
  }

  // Both fields are well-formed
  return { meta: { authors, solutionLink }, error: null }
}

/**
 * Splits a problem body into its statement and solution halves on the solution
 * sentinel, remembering where the solution half begins.
 *
 * @param body - The body file's full contents.
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
