/**
 * Core orchestration for the draft preflight: walks a draft folder, validates
 * each problem's markdown through the renderer's own pipeline, resolves image
 * references on disk, and assembles the {@link DraftManifest}.
 */

import fs from 'fs'
import path from 'path'
import { parse as parseYaml } from 'yaml'

import { validateMarkdown } from '../src/components/shared/components/rich-math-editor/utils/markdown-pipeline'
import type { Locale } from '../src/i18n/i18n'
import { SUPPORTED_LOCALES } from '../src/i18n/i18n'
import type { MetaResult } from './preflight-draft-meta'
import { FALLBACK_META, META_FILENAME, metaIssue, narrowMeta } from './preflight-draft-meta'
import {
  asMessage,
  collectImageNames,
  hasLeadingFrontmatter,
  IMAGE_REF_PREFIX,
  IMAGES_DIRNAME,
  MAX_IMAGE_MB,
  parseProblemMeta,
  splitOnSentinel,
  SUPPORTED_IMAGE_EXTENSIONS,
  toAbsoluteLine,
} from './preflight-draft-parse'
import type {
  DraftManifest,
  ManifestProblem,
  ManifestText,
  ProblemHalf,
  VerdictError,
  VerdictSeverity,
} from './preflight-draft-types'

/** A discovered `pN.<lang>.md` body file with the raw language token from its name. */
type BodyFile = {
  /** The body filename (e.g. `p1.en.md`). */
  file: string
  /** The raw language token from the filename (e.g. `en`). */
  langToken: string
}

/** One problem's files grouped by order: its `pN.yaml` metadata and its `pN.<lang>.md` bodies. */
type ProblemGroup = {
  /** The 1-based order parsed from the filenames. */
  order: number
  /** The `pN.yaml` metadata filename, or `null` when no metadata file was found for this order. */
  metaFile: string | null
  /** The `pN.<lang>.md` body files found for this order, in readdir order. */
  bodies: BodyFile[]
}

/**
 * Runs the whole preflight against a draft folder and assembles its manifest.
 * Malformed input surfaces as a verdict entry instead of throwing.
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

  // Group the problem files by order
  const groups = groupProblemFiles(folderPath, errors)

  // One manifest entry per problem, kept in numeric order for stable output
  const problems: ManifestProblem[] = []
  for (const group of groups) {
    problems.push(await parseProblem(folderPath, group, metaResult.meta.language, errors))
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
 * Groups a draft folder's `pN.yaml` metadata files and `pN.<lang>.md` body files
 * by problem order, flagging a missing, non-contiguous, or duplicated numbering
 * scheme plus any order that lacks its metadata file or any body file.
 *
 * @param folderPath - Path to the draft folder.
 * @param errors - Accumulator the structural issues are pushed onto.
 *
 * @returns One {@link ProblemGroup} per discovered order, in numeric order.
 */
function groupProblemFiles(folderPath: string, errors: VerdictError[]): ProblemGroup[] {
  // Read the folder's entries
  const names = fs.readdirSync(folderPath)

  // The metadata files (pN.yaml), each carrying its parsed order
  const metaFiles = names
    .map((name) => {
      const match = /^p(\d+)\.yaml$/.exec(name)
      return match ? { file: name, order: Number(match[1]) } : null
    })
    .filter((entry): entry is { file: string; order: number } => entry !== null)

  // The body files (pN.<lang>.md), each carrying its order and language token
  const bodyFiles = names
    .map((name) => {
      const match = /^p(\d+)\.([a-z]+)\.md$/.exec(name)
      return match ? { file: name, order: Number(match[1]), langToken: match[2]! } : null
    })
    .filter((entry): entry is { file: string; order: number; langToken: string } => entry !== null)

  // A folder with nothing problem-shaped has nothing to import
  if (metaFiles.length === 0 && bodyFiles.length === 0) {
    errors.push(
      problemIssue('(folder)', null, 'problem-files', 'no problem files found (expected pN.yaml)')
    )
    return []
  }

  // The orders claimed by metadata files
  const metaOrders = metaFiles.map((entry) => entry.order)

  // Two files resolving to the same order (e.g. p1.yaml and p01.yaml) is ambiguous
  const duplicateOrders = [
    ...new Set(metaOrders.filter((order, index) => metaOrders.indexOf(order) !== index)),
  ]

  // Report each ambiguous order
  duplicateOrders.forEach((order) => {
    const files = metaFiles.filter((entry) => entry.order === order).map((entry) => entry.file)
    errors.push(
      problemIssue(
        '(folder)',
        null,
        'problem-files',
        `duplicate problem ${order}: ${files.join(', ')}`
      )
    )
  })

  // Every order that appears in either file set, in ascending order
  const orders = [...new Set([...metaOrders, ...bodyFiles.map((entry) => entry.order)])].sort(
    (first, second) => first - second
  )

  // Pair each order's metadata file with its body files
  const groups = orders.map((order) => ({
    order,
    metaFile: metaFiles.find((entry) => entry.order === order)?.file ?? null,
    bodies: bodyFiles
      .filter((entry) => entry.order === order)
      .map((entry) => ({ file: entry.file, langToken: entry.langToken })),
  }))

  // Numbering must run 1, 2, 3, … with no gaps
  const gapIndex = orders.findIndex((order, index) => order !== index + 1)
  if (gapIndex !== -1) {
    errors.push(
      problemIssue(
        '(folder)',
        null,
        'problem-files',
        `problem numbering is not contiguous (expected p${gapIndex + 1}.yaml)`
      )
    )
  }

  // A problem with body files but no metadata file, or a metadata file with no bodies, is incomplete
  groups.forEach((group) => {
    if (group.metaFile === null) {
      errors.push(
        problemIssue(
          `p${group.order}.yaml`,
          null,
          'missing-problem-meta',
          `problem ${group.order} has body files but no p${group.order}.yaml metadata file`
        )
      )
    } else if (group.bodies.length === 0) {
      errors.push(
        problemIssue(
          group.metaFile,
          null,
          'missing-body',
          `problem ${group.order} has no pN.<lang>.md body files`
        )
      )
    }
  })

  // Hand back the groups in numeric order
  return groups
}

/**
 * Parses one problem group into a {@link ManifestProblem}: its `pN.yaml`
 * metadata plus every `pN.<lang>.md` body as a text variant, flagging a missing
 * original, a translated solution with no original solution, and unresolved
 * images.
 *
 * @param folderPath - Path to the draft folder.
 * @param group - The problem's grouped files.
 * @param originalLanguage - The draft's original language (`meta.language`).
 * @param errors - Accumulator the problem's issues are pushed onto.
 *
 * @returns The assembled manifest entry for this problem.
 */
async function parseProblem(
  folderPath: string,
  group: ProblemGroup,
  originalLanguage: Locale,
  errors: VerdictError[]
): Promise<ManifestProblem> {
  // Problem metadata lives in pN.yaml; default each field for the no-metadata case
  let authors: string[] | null = null
  let solutionLink: string | null = null
  let tags: string[] | null = null
  if (group.metaFile !== null) {
    // Parse the sidecar
    const { meta, error } = parseProblemMeta(
      fs.readFileSync(path.join(folderPath, group.metaFile), 'utf-8')
    )

    // Surface a malformed sidecar
    if (error !== null) {
      errors.push(problemIssue(group.metaFile, null, 'problem-meta', error))
    }

    // Adopt the parsed fields
    authors = meta.authors
    solutionLink = meta.solutionLink
    tags = meta.tags
  }

  // Parse each body into a text variant, dropping ones whose language token is unknown
  const parsedBodies: ParsedBody[] = []
  for (const body of group.bodies) {
    const parsed = await parseBody(folderPath, body, originalLanguage, errors)
    if (parsed !== null) parsedBodies.push(parsed)
  }

  // The original is the variant in the draft's language; its absence is an error
  const original = parsedBodies.find((entry) => entry.text.original)
  if (original === undefined) {
    errors.push(
      problemIssue(
        `p${group.order}.${originalLanguage}.md`,
        null,
        'missing-original',
        `problem ${group.order} has no ${originalLanguage} body (the original language)`
      )
    )
  }

  // A translated solution with no original solution to attach to would dangle
  if (original !== undefined && original.text.solutionMarkdown === null) {
    parsedBodies
      .filter((entry) => !entry.text.original && entry.text.solutionMarkdown !== null)
      .forEach((entry) => {
        errors.push(
          problemIssue(
            `p${group.order}.${entry.text.language}.md`,
            'solution',
            'translation-solution-without-original',
            `the ${entry.text.language} translation has a solution but the ${originalLanguage} original does not`
          )
        )
      })
  }

  // Order the variants original-first, then translations in supported-locale order
  const texts = parsedBodies
    .map((entry) => entry.text)
    .sort((first, second) => textRank(first, originalLanguage) - textRank(second, originalLanguage))

  // The images the problem references are the union across its bodies (shared across languages)
  const images = [...new Set(parsedBodies.flatMap((entry) => entry.images))]

  // Two images sharing a stem would collide on one media key ({slug}-{stem}); reject so neither silently overwrites
  // the other. Case-insensitive, since the key derives from the stem.
  const stems = images.map((name) => path.parse(name).name.toLowerCase())
  const collidingStems = [...new Set(stems.filter((stem, index) => stems.indexOf(stem) !== index))]
  collidingStems.forEach((stem) => {
    const names = images.filter((name) => path.parse(name).name.toLowerCase() === stem)
    errors.push(
      problemIssue(
        `p${group.order}.yaml`,
        null,
        'image-stem-collision',
        `images ${names.map((name) => `"${name}"`).join(' and ')} share a name and would collide on one media key; rename one`
      )
    )
  })

  // Assemble this problem's manifest entry
  return { order: group.order, authors, solutionLink, tags, texts, images }
}

/** A parsed body file: its text variant plus the image basenames it references. */
type ParsedBody = {
  /** The text variant assembled from the body. */
  text: ManifestText
  /** The image basenames this body references. */
  images: string[]
}

/**
 * Parses one body file into a {@link ManifestText}, validating both markdown
 * halves and resolving its image references against disk. Returns `null` when
 * the filename's language token is not a supported locale.
 *
 * @param folderPath - Path to the draft folder.
 * @param body - The body file and its raw language token.
 * @param originalLanguage - The draft's original language, deciding `original`.
 * @param errors - Accumulator the body's issues are pushed onto.
 *
 * @returns The text variant and its images, or `null` for an unknown language.
 */
async function parseBody(
  folderPath: string,
  body: BodyFile,
  originalLanguage: Locale,
  errors: VerdictError[]
): Promise<ParsedBody | null> {
  // The language token must be a supported locale to become a text variant
  const language = SUPPORTED_LOCALES.find((locale) => locale === body.langToken)
  if (language === undefined) {
    errors.push(
      problemIssue(
        body.file,
        null,
        'unknown-lang',
        `unknown language "${body.langToken}" (expected one of ${SUPPORTED_LOCALES.join(', ')})`
      )
    )
    return null
  }

  // Bodies are content-only, so a leading frontmatter fence is a mistake (metadata belongs in pN.yaml)
  const content = fs.readFileSync(path.join(folderPath, body.file), 'utf-8')
  if (hasLeadingFrontmatter(content)) {
    errors.push(
      problemIssue(
        body.file,
        null,
        'body-frontmatter',
        "body is content-only — move metadata to the problem's pN.yaml"
      )
    )
  }

  // Split the body into statement and solution
  const { statement, solution, solutionBodyLine0 } = splitOnSentinel(content)
  if (statement.trim() === '') {
    errors.push(problemIssue(body.file, 'statement', 'empty-statement', 'statement is empty'))
  }

  // Validate each half, mapping positions back to the body file (no frontmatter, so it starts at line 0)
  await validateHalf(statement, body.file, 'statement', 0, errors)
  if (solution !== null) {
    await validateHalf(solution, body.file, 'solution', solutionBodyLine0 ?? 0, errors)
  }

  // Gather this body's image references across both halves and validate each — it must exist on disk, be a supported
  // format, and stay under the size cap — so a bad figure fails in preflight rather than mid-import.
  const solutionImages = solution !== null ? collectImageNames(solution) : []
  const images = [...new Set([...collectImageNames(statement), ...solutionImages])]
  images.forEach((name) => {
    // Get the full image path
    const imagePath = path.join(folderPath, IMAGES_DIRNAME, name)

    // Missing on disk — the reference points at nothing.
    if (!fs.existsSync(imagePath)) {
      errors.push(
        problemIssue(
          body.file,
          null,
          'missing-image',
          `referenced image "${IMAGE_REF_PREFIX}${name}" not found on disk`
        )
      )
      return
    }

    // Wrong format — only SVG and the supported raster formats are allowed.
    if (!SUPPORTED_IMAGE_EXTENSIONS.includes(path.extname(name).toLowerCase())) {
      errors.push(
        problemIssue(
          body.file,
          null,
          'unsupported-image-format',
          `image "${IMAGE_REF_PREFIX}${name}" has an unsupported format ` +
            `(expected one of ${SUPPORTED_IMAGE_EXTENSIONS.join(', ')})`
        )
      )
      return
    }

    // Too heavy — over the size cap.
    const sizeBytes = fs.statSync(imagePath).size
    if (sizeBytes > MAX_IMAGE_MB * 1024 * 1024) {
      const sizeMb = (sizeBytes / 1024 / 1024).toFixed(1)
      errors.push(
        problemIssue(
          body.file,
          null,
          'oversized-image',
          `image "${IMAGE_REF_PREFIX}${name}" is ${sizeMb} MB, over the ${MAX_IMAGE_MB} MB limit; downscale it`
        )
      )
    }
  })

  // Assemble the text variant, halves kept verbatim
  const text: ManifestText = {
    language,
    original: language === originalLanguage,
    statementMarkdown: statement,
    solutionMarkdown: solution,
  }

  // Hand back the variant with its referenced images
  return { text, images }
}

/**
 * Sort key that places the original variant first and the translations after it
 * in supported-locale order.
 *
 * @param text - The text variant to rank.
 * @param originalLanguage - The draft's original language.
 *
 * @returns `-1` for the original, otherwise the language's index among the locales.
 */
function textRank(text: ManifestText, originalLanguage: Locale): number {
  // The original always sorts ahead of every translation
  return text.language === originalLanguage ? -1 : SUPPORTED_LOCALES.indexOf(text.language)
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
