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

/** Path prefix marking an image reference as draft-local: `images/`. */
export const IMAGE_REF_PREFIX = `${IMAGES_DIRNAME}/`

/** Supported image formats — SVG plus the raster formats that can be sized and served. */
export const SUPPORTED_IMAGE_EXTENSIONS = ['.svg', '.png', '.jpg', '.jpeg', '.webp']

/** Per-image size ceiling, in MB. Figures ship unoptimized, so oversized scans must be downscaled. */
export const MAX_IMAGE_MB = 2

/**
 * The only query param a problem image ref may carry — inline display. `width`/`height` are auto-derived
 * from the figure's intrinsic size on import, and `scale` has no role on a problem image, so any other
 * param is an authoring error.
 */
const ALLOWED_IMAGE_REF_PARAMS = ['inline']

/** HTML-comment line that separates a problem's statement from its solution. */
const SOLUTION_SENTINEL = '<!-- solution -->'

/** HTML-comment line that opens one of the author's hints. Each hint has its own. */
const HINT_SENTINEL = '<!-- hint -->'

/** Typed metadata fields from a problem's `pN.yaml`. */
type ProblemMeta = {
  /** Author display names, or `null` when no `authors:` key is present — kept distinct from `[]` (an explicit clear). */
  authors: string[] | null
  /** External solution URL, or `null` when absent. */
  solutionLink: string | null
  /** Tag slugs, or `null` when no `tags:` key is present — kept distinct from `[]` (an explicit clear). */
  tags: string[] | null
}

/** A problem-metadata parse outcome — values plus the first structural error, if any. */
type ProblemMetaParse = {
  /** Best-effort parsed values (defaults when a field is missing). */
  meta: ProblemMeta
  /** First structural problem found, or `null` when the metadata is well-formed. */
  error: string | null
}

/** One of the author's hints, tracking where in the body it begins. */
type SentinelHint = {
  /** The hint's markdown, everything under its sentinel up to the next one. */
  markdown: string
  /** 0-based body-relative line index where the hint starts. */
  bodyLine0: number
}

/** One section a sentinel opens, as the split finds it: the sentinel's line and the lines under it. */
type SentinelSection = {
  /** Which sentinel opened it. */
  sentinel: typeof SOLUTION_SENTINEL | typeof HINT_SENTINEL
  /** 0-based body-relative line index of the sentinel itself. */
  line0: number
  /** The lines under the sentinel, up to the next one. */
  lines: string[]
}

/** A body split on its sentinels, tracking where the solution half and each hint begin. */
type SentinelSplit = {
  /** Statement markdown (everything before the first sentinel). */
  statement: string
  /** Solution markdown (everything under the solution sentinel), or `null` when there is no sentinel. */
  solution: string | null
  /** 0-based body-relative line index where the solution half starts, or `null`. */
  solutionBodyLine0: number | null
  /** The author's hints in body order; empty when the body has no hint sentinel. */
  hints: SentinelHint[]
}

/** Metadata values for a problem whose `pN.yaml` declares none. */
const EMPTY_PROBLEM_META: ProblemMeta = { authors: null, solutionLink: null, tags: null }

/** A processor used only to parse markdown into an mdast tree for image discovery. */
const imageRefProcessor = unified().use(remarkParse)

/** A draft-local image ref that carries a query param the author isn't allowed to write. */
export type DisallowedImageRefParams = {
  /** The image ref exactly as written, e.g. `images/fig.svg?width=400&height=300`. */
  ref: string
  /** The disallowed query param names found on it (everything but `inline`), in first-seen order. */
  params: string[]
}

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

  // authors is an optional list of strings; an absent key stays null (leave existing authors) rather than [] (clear)
  const rawAuthors = parsed.authors
  let authors: string[] | null = null
  if (rawAuthors !== undefined && rawAuthors !== null) {
    // Reject a non-list or non-string entries, keeping the fields parsed so far
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
        meta: { authors, solutionLink: null, tags: null },
        error: 'metadata "solutionLink" must be a string',
      }
    }
    solutionLink = rawLink
  }

  // tags is an optional list of strings; an absent key stays null (leave existing tags) rather than [] (clear)
  const rawTags = parsed.tags
  let tags: string[] | null = null
  if (rawTags !== undefined && rawTags !== null) {
    // Reject a non-list or non-string entries, keeping the fields parsed so far
    if (!Array.isArray(rawTags) || !rawTags.every((tag) => typeof tag === 'string')) {
      return {
        meta: { authors, solutionLink, tags: null },
        error: 'metadata "tags" must be a list of strings',
      }
    }
    tags = rawTags
  }

  // Every field is well-formed
  return { meta: { authors, solutionLink, tags }, error: null }
}

/**
 * Splits a problem body on its sentinels: the statement is everything before the
 * first one, and the solution and each hint are the sections their sentinels
 * open, in whichever order they come. Each section remembers where it begins.
 *
 * @param body - The body file's full contents.
 *
 * @returns The statement, the solution (or `null` when there is no solution
 *   sentinel) with its 0-based body-relative start line, and the hints.
 */
export function splitOnSentinels(body: string): SentinelSplit {
  // Work line by line so every section's start line is exact
  const lines = body.split('\n')

  // Every sentinel line, in body order, with the lines it owns
  const sections = lines.reduce<SentinelSection[]>((found, line, index) => {
    // A sentinel is a standalone comment line, and opens a section of its own
    const trimmed = line.trim()
    if (trimmed === SOLUTION_SENTINEL || trimmed === HINT_SENTINEL) {
      return [...found, { sentinel: trimmed, line0: index, lines: [] }]
    }

    // Every other line belongs to the last section opened, or to the statement while none is
    found.at(-1)?.lines.push(line)

    // The same sections, one line longer
    return found
  }, [])

  // Statement is everything above the first sentinel; without one the whole body is the statement
  const firstSentinel = sections[0]
  const statement =
    firstSentinel === undefined ? body : lines.slice(0, firstSentinel.line0).join('\n')

  // The first solution sentinel owns the solution; a body carries at most one
  const solutionSection = sections.find((section) => section.sentinel === SOLUTION_SENTINEL)

  // Every hint sentinel is one rung of the ladder, in body order
  const hints = sections
    .filter((section) => section.sentinel === HINT_SENTINEL)
    .map((section) => ({ markdown: section.lines.join('\n'), bodyLine0: section.line0 + 1 }))

  // Each section as the text under its sentinel, starting on the line after it
  return {
    statement,
    solution: solutionSection === undefined ? null : solutionSection.lines.join('\n'),
    solutionBodyLine0: solutionSection === undefined ? null : solutionSection.line0 + 1,
    hints,
  }
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

/**
 * Collects the draft-local image refs that carry a disallowed query param. A problem ref must be bare
 * except for `?inline=`: the figure's `width`/`height` are auto-derived on import and `scale` has no
 * role on a problem image, so anything else (`width`, `height`, `scale`, a typo) is an authoring error.
 * External (`http(s)`) images are skipped — the import never stamps them.
 *
 * @param markdown - The markdown half to scan.
 *
 * @returns One entry per offending ref, each with its disallowed param names.
 */
export function collectDisallowedImageRefParams(markdown: string): DisallowedImageRefParams[] {
  // Parse to a tree so only genuine image nodes are considered
  const tree = imageRefProcessor.parse(markdown)
  const offending: DisallowedImageRefParams[] = []

  // Only `image` nodes survive parsing, so code-fenced look-alikes never reach here
  visit(tree, 'image', (node) => {
    // Split the path from the query
    const [refPath, query] = node.url.split('?', 2)

    // Only disk-relative refs under images/ that carry a query are ours to police
    if (!refPath?.startsWith(IMAGE_REF_PREFIX) || query === undefined) return

    // The query's param names, deduped
    const names = [...new Set([...new URLSearchParams(query).keys()])]

    // Drop the one param an author may legally write; anything left is disallowed
    const disallowed = names.filter((name) => !ALLOWED_IMAGE_REF_PARAMS.includes(name))

    // Record the ref (as written) and its offending params when any survive
    if (disallowed.length > 0) offending.push({ ref: node.url, params: disallowed })
  })

  // The offending refs in first-seen order
  return offending
}
