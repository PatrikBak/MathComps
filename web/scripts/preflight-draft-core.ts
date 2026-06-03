/**
 * Core orchestration for the draft preflight: walks a draft folder, validates
 * each problem's markdown through the renderer's own pipeline, resolves image
 * references on disk, and assembles the {@link DraftManifest}.
 */

import fs from 'fs'
import path from 'path'
import { parse as parseYaml } from 'yaml'

import { validateMarkdown } from '../src/components/shared/components/rich-math-editor/utils/markdown-pipeline'
import type { MetaResult } from './preflight-draft-meta'
import { FALLBACK_META, META_FILENAME, metaIssue, narrowMeta } from './preflight-draft-meta'
import {
  asMessage,
  collectImageNames,
  IMAGE_REF_PREFIX,
  IMAGES_DIRNAME,
  parseFrontmatter,
  splitFrontmatter,
  splitOnSentinel,
  toAbsoluteLine,
} from './preflight-draft-parse'
import type {
  DraftManifest,
  ManifestProblem,
  ProblemHalf,
  VerdictError,
  VerdictSeverity,
} from './preflight-draft-types'

/** A discovered problem file paired with the order parsed from its name. */
type ProblemFile = {
  /** The problem filename (e.g. `p1.md`). */
  file: string
  /** The 1-based order parsed from the filename. */
  order: number
}

/**
 * Runs the whole preflight against a draft folder and assembles its manifest.
 * Never throws on malformed input — every problem surfaces as a verdict entry.
 *
 * @param folderPath - Path to the draft folder to validate.
 *
 * @returns The assembled {@link DraftManifest}.
 */
export async function preflightDraft(folderPath: string): Promise<DraftManifest> {
  // Every issue across the run accumulates here in deterministic order
  const errors: VerdictError[] = []

  // Folder-level taxonomy first
  const metaResult = readMeta(folderPath)
  errors.push(...metaResult.errors)

  // One manifest entry per problem file, kept in numeric order for stable output
  const problemFiles = listProblemFiles(folderPath, errors)
  const problems: ManifestProblem[] = []
  for (const problemFile of problemFiles) {
    problems.push(await parseProblem(folderPath, problemFile.file, problemFile.order, errors))
  }

  // Image files referenced by nobody are advisory leftovers, not failures
  collectOrphanImageWarnings(folderPath, problems, errors)

  // Hand back the taxonomy, problems, and the issues
  return { meta: metaResult.meta, problems, verdict: { errors } }
}

/**
 * Derives a run's pass/fail from its accumulated issues.
 *
 * @param errors - Every issue found during the run.
 *
 * @returns `true` when no issue has `error` severity — warnings never fail a run.
 */
export function isOk(errors: VerdictError[]): boolean {
  // A run passes only when nothing rises to error severity
  return !errors.some((error) => error.severity === 'error')
}

/**
 * Reads and parses `_meta.yaml`, delegating field narrowing to
 * {@link narrowMeta} and turning a missing or unparseable file into an error.
 *
 * @param folderPath - Path to the draft folder.
 *
 * @returns The best-effort meta and any file- or field-level issues.
 */
function readMeta(folderPath: string): MetaResult {
  // Resolve the full-path to the metadata file
  const metaPath = path.join(folderPath, META_FILENAME)

  // The taxonomy file is mandatory
  if (!fs.existsSync(metaPath)) {
    return { meta: FALLBACK_META, errors: [metaIssue(`${META_FILENAME} not found`)] }
  }

  // Safely parse the metadata file
  let parsed: unknown
  try {
    parsed = parseYaml(fs.readFileSync(metaPath, 'utf-8'))
  } catch (error) {
    return {
      meta: FALLBACK_META,
      errors: [metaIssue(`${META_FILENAME} is not valid YAML: ${asMessage(error)}`)],
    }
  }

  // Narrow the parsed document into typed fields
  return narrowMeta(parsed)
}

/**
 * Lists the `pN.md` problem files in numeric order and flags a missing,
 * non-contiguous, or duplicated numbering scheme.
 *
 * @param folderPath - Path to the draft folder.
 * @param errors - Accumulator the sequencing issues are pushed onto.
 *
 * @returns The matched problem files paired with their 1-based order.
 */
function listProblemFiles(folderPath: string, errors: VerdictError[]): ProblemFile[] {
  // Match `p<number>.md` and carry the parsed number alongside the filename
  const matched = fs
    .readdirSync(folderPath)
    .map((name) => {
      const match = /^p(\d+)\.md$/.exec(name)
      return match ? { file: name, order: Number(match[1]) } : null
    })
    .filter((entry): entry is ProblemFile => entry !== null)
    .sort((first, second) => first.order - second.order)

  // A draft with no problems has nothing to import
  if (matched.length === 0) {
    errors.push(problemIssue('(folder)', null, 'problem-files', 'no pN.md problem files found'))
    return matched
  }

  // Two files resolving to the same number (e.g. p1.md and p01.md) is ambiguous
  const orders = matched.map((entry) => entry.order)
  if (new Set(orders).size !== orders.length) {
    errors.push(
      problemIssue(
        '(folder)',
        null,
        'problem-files',
        `duplicate problem numbers: ${orders.join(', ')}`
      )
    )
  }

  // Numbering must run 1, 2, 3, … with no gaps
  const gapIndex = orders.findIndex((order, index) => order !== index + 1)
  if (gapIndex !== -1) {
    const expected = `p${gapIndex + 1}.md`
    errors.push(
      problemIssue(
        matched[gapIndex]!.file,
        null,
        'problem-files',
        `problem numbering is not contiguous (expected ${expected})`
      )
    )
  }

  // Hand back the files in numeric order
  return matched
}

/**
 * Parses one problem file into a {@link ManifestProblem}, validating both
 * markdown halves and resolving its image references against disk.
 *
 * @param folderPath - Path to the draft folder.
 * @param file - The problem filename (e.g. `p1.md`).
 * @param order - The problem's 1-based order.
 * @param errors - Accumulator the problem's issues are pushed onto.
 *
 * @returns The assembled manifest entry for this problem.
 */
async function parseProblem(
  folderPath: string,
  file: string,
  order: number,
  errors: VerdictError[]
): Promise<ManifestProblem> {
  // Read the problem file
  const content = fs.readFileSync(path.join(folderPath, file), 'utf-8')

  // Peel off frontmatter
  const { frontmatterText, body, bodyStartLine0, unterminated } = splitFrontmatter(content)
  if (unterminated) {
    errors.push(
      problemIssue(
        file,
        null,
        'frontmatter',
        'frontmatter block is not terminated with a closing ---'
      )
    )
  }

  // Parse the frontmatter
  const { frontmatter, error: frontmatterError } = parseFrontmatter(frontmatterText)
  if (frontmatterError !== null) {
    errors.push(problemIssue(file, null, 'frontmatter', frontmatterError))
  }

  // Split the body into problem and solution
  const { statement, solution, solutionBodyLine0 } = splitOnSentinel(body)
  if (statement.trim() === '') {
    errors.push(problemIssue(file, 'statement', 'empty-statement', 'statement is empty'))
  }

  // Ensure statement is valid
  await validateHalf(statement, file, 'statement', bodyStartLine0, errors)

  // Ensure solution is valid if there is any
  if (solution !== null) {
    // The solution starts after the statement and the sentinel line
    const solutionStartLine0 = bodyStartLine0 + (solutionBodyLine0 ?? 0)
    await validateHalf(solution, file, 'solution', solutionStartLine0, errors)
  }

  // Gather image references across both halves,
  const solutionImages = solution !== null ? collectImageNames(solution) : []
  const images = [...new Set([...collectImageNames(statement), ...solutionImages])]

  // Check each image resolves on disk
  images
    .filter((name) => !fs.existsSync(path.join(folderPath, IMAGES_DIRNAME, name)))
    .forEach((name) => {
      errors.push(
        problemIssue(
          file,
          null,
          'missing-image',
          `referenced image "${IMAGE_REF_PREFIX}${name}" not found on disk`
        )
      )
    })

  // Assemble this problem's manifest entry, halves kept verbatim for C#
  return {
    order,
    authors: frontmatter.authors,
    solutionLink: frontmatter.solutionLink,
    statementMarkdown: statement,
    solutionMarkdown: solution,
    images,
  }
}

/**
 * Validates one markdown half and, on failure, records the issue with its
 * position mapped back to the source file.
 *
 * @param text - The half's markdown.
 * @param file - The problem filename the half belongs to.
 * @param half - Which half is being validated.
 * @param halfStartLine0 - 0-based source line index where the half begins.
 * @param errors - Accumulator the validation issue is pushed onto.
 */
async function validateHalf(
  text: string,
  file: string,
  half: ProblemHalf,
  halfStartLine0: number,
  errors: VerdictError[]
): Promise<void> {
  // An empty half has nothing to render; emptiness is reported separately where it matters
  if (text.trim() === '') return

  // A failed half becomes a positioned error mapped back to the source file
  const result = await validateMarkdown(text)
  if (!result.ok) {
    errors.push({
      file,
      half,
      line: toAbsoluteLine(halfStartLine0, result.line ?? null),
      col: result.column ?? null,
      rule: result.stage,
      message: result.error,
      severity: 'error',
    })
  }
}

/**
 * Warns for every file in the `images/` subfolder that no problem references.
 *
 * @param folderPath - Path to the draft folder.
 * @param problems - The assembled problems whose references define what is used.
 * @param errors - Accumulator the orphan warnings are pushed onto.
 */
function collectOrphanImageWarnings(
  folderPath: string,
  problems: ManifestProblem[],
  errors: VerdictError[]
): void {
  // No images folder means there is nothing to flag
  const imagesDir = path.join(folderPath, IMAGES_DIRNAME)
  if (!fs.existsSync(imagesDir)) return

  // Any file on disk that no problem references is an advisory leftover
  const referenced = new Set(problems.flatMap((problem) => problem.images))
  fs.readdirSync(imagesDir)
    .filter((name) => fs.statSync(path.join(imagesDir, name)).isFile())
    .filter((name) => !referenced.has(name))
    .sort()
    .forEach((name) => {
      errors.push({
        file: `${IMAGE_REF_PREFIX}${name}`,
        half: null,
        line: null,
        col: null,
        rule: 'orphan-image',
        message: `image "${IMAGE_REF_PREFIX}${name}" is referenced by no problem`,
        severity: 'warning',
      })
    })
}

/**
 * Builds a problem-scoped issue with no source position.
 *
 * @param file - The problem filename the issue belongs to.
 * @param half - The half the issue belongs to, or `null` for file-level issues.
 * @param rule - The machine-readable issue category.
 * @param message - The human-readable description.
 * @param severity - Whether the issue blocks import; defaults to `error`.
 *
 * @returns The assembled {@link VerdictError}.
 */
function problemIssue(
  file: string,
  half: ProblemHalf | null,
  rule: string,
  message: string,
  severity: VerdictSeverity = 'error'
): VerdictError {
  // Problem-scoped issues never carry a source position
  return { file, half, line: null, col: null, rule, message, severity }
}
