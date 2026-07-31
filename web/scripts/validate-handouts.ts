/**
 * Validates handout content structure:
 * - Every handout in handouts.json has matching .{locale}.json content files
 *   for its declared languages (or all locales when languages is absent)
 * - All localized fields have values for all declared languages
 * - Every environment in a content file has a non-empty, unique-within-its-handout id, and every
 *   language variant of a handout carries the same ids, in the same order
 * - Every environment carries a name in each of its handout's languages, shaped for a URL and unique
 *   within that language variant
 * - The generated `handout-env-index.json` matches what the content files actually say
 *
 * Run with: tsx scripts/validate-handouts.ts
 */

import fs from 'fs'
import path from 'path'

import { HANDOUT_ENVIRONMENT_TYPES } from '../src/components/features/handouts/handout-content-types'
import {
  getContentFileBasename,
  HANDOUT_DIFFICULTY_LEVELS,
  type HandoutDifficulty,
  type HandoutIndex,
  type HandoutMetadata,
  supportsLocale,
} from '../src/components/features/handouts/handout-metadata-types'
import { DEFAULT_LOCALE, type Locale, SUPPORTED_LOCALES } from '../src/i18n/i18n'
import {
  validateDateFormat,
  validatePartialLocalizedString,
  validateRequiredArray,
  validateRequiredField,
  validateUniqueness,
} from '../src/lib/content-validation'
import {
  collectAllHandoutEnvironments,
  ENV_INDEX_PATH,
  toHandoutEnvIndex,
} from './handout-env-index'
import { runValidator, validateNoOrphans } from './validation-runner'

/** Directory containing handout content files */
const CONTENT_DIR = path.join(process.cwd(), 'src/content/handouts')

/** Path to handouts.json */
const INDEX_PATH = path.join(CONTENT_DIR, '../handouts.json')

/** The shape of an environment's permanent id: the same 21-character nanoid a handout itself is identified by. */
const ENVIRONMENT_ID_PATTERN = /^[A-Za-z0-9_-]{21}$/

/** The shape of an environment's name: lowercase alphanumeric words joined by single hyphens, as a URL wants. */
const ENVIRONMENT_SLUG_PATTERN = /^[a-z0-9]+(-[a-z0-9]+)*$/

/**
 * An environment block as it appears in an untyped content JSON: only what the checks below read. A block is
 * narrowed to this shape by its `type` before `id` is trusted — an {@link ImageBlock} also carries an `id`, for
 * an unrelated asset, and must never be mistaken for an environment.
 */
type ContentEnvironment = {
  /** The environment's permanent id, unnarrowed until checked. */
  id?: unknown
  /** The environment's name in this variant's language, unnarrowed until checked. */
  slug?: unknown
  /** The environment's type. */
  type: string
}

/** A section's block container. */
type ContentSectionText = {
  /** The blocks written directly under the section. */
  content: ContentEnvironment[]
}

/** One section of a content document. */
type ContentSection = {
  /** The section's block container. */
  text: ContentSectionText
}

/** A content file's parsed document, narrowed to what the checks below walk. */
type ContentDocument = {
  /** The document's sections, in reading order. */
  sections: ContentSection[]
}

/**
 * Returns the locales a handout supports.
 * Defaults to all supported locales when `languages` is absent.
 *
 * @param handout - The handout metadata to inspect.
 *
 * @returns The locales the handout declares, or all supported locales.
 */
function getHandoutLocales(handout: HandoutMetadata): readonly Locale[] {
  // The declared languages, or every supported locale when none are declared
  return handout.languages ?? SUPPORTED_LOCALES
}

/**
 * Returns a human-readable title for error messages, using the first declared language.
 *
 * @param handout - The handout metadata to extract a display name from.
 *
 * @returns A formatted string like `handout "Průměry"`.
 */
function getDisplayName(handout: HandoutMetadata): string {
  // Name the handout in its first declared language, else the default locale
  const locale = handout.languages?.[0] ?? DEFAULT_LOCALE
  // A readable label like `handout "Průměry"`
  return `handout "${handout.title[locale] ?? 'unknown'}"`
}

/**
 * Validates that a handout's difficulty is one of the allowed levels.
 *
 * @param difficulty - The candidate difficulty value (untyped at runtime).
 * @param context - The handout label for error messages.
 *
 * @yields An error when the difficulty is missing or out of range.
 */
function* validateDifficulty(difficulty: unknown, context: string): Generator<string> {
  // Flag a difficulty outside the allowed level set
  if (!HANDOUT_DIFFICULTY_LEVELS.includes(difficulty as HandoutDifficulty)) {
    const allowed = HANDOUT_DIFFICULTY_LEVELS.join(', ')
    yield `❌ Invalid difficulty "${difficulty}" for ${context} (expected one of: ${allowed})`
  }
}

/**
 * Flags an environment block found below a section's top level, where the renderer never looks for one and the
 * checks below would never see it. Environments sit at `document.sections[].text.content[]` today (verified
 * against every content file); this guard stops a future parser change from silently hiding one from validation.
 *
 * @param node - The value to search, recursively.
 * @param context - Where this node came from, for the error message.
 *
 * @yields An error for each nested environment block found.
 */
function* validateNoNestedEnvironments(node: unknown, context: string): Generator<string> {
  // Only objects and arrays can contain a nested block
  if (node === null || typeof node !== 'object') {
    return
  }

  // The node, on the chance it's an environment block nested inside another block's fields (body, solution,
  // proof, list items, ...)
  const block = node as ContentEnvironment

  // Flag it if it really is one
  if (
    HANDOUT_ENVIRONMENT_TYPES.includes(block.type as (typeof HANDOUT_ENVIRONMENT_TYPES)[number])
  ) {
    yield `❌ Nested "${block.type}" environment found below a section's top level in ${context}`
  }

  // Search every field, since an environment could in principle hide inside any of them
  for (const value of Object.values(node)) {
    yield* validateNoNestedEnvironments(value, context)
  }
}

/**
 * Validates one handout's environment ids and names: every environment has both, no id repeats within the
 * handout, no name repeats within a language variant, and every declared variant carries the same `[id, type]`
 * sequence in the same order as the first. Along the way, also runs the nesting guard over every top-level
 * block's own fields.
 *
 * @param handout - The handout to validate.
 * @param requiredLocales - The locales this handout declares.
 * @param handoutContext - The handout's display label, for error messages.
 *
 * @yields An error for every id or name problem found.
 */
function* validateHandoutEnvironmentIds(
  handout: HandoutMetadata,
  requiredLocales: readonly Locale[],
  handoutContext: string
): Generator<string> {
  // The base filename shared by every locale's content file
  const slug = getContentFileBasename(handout)

  // Per-locale environment lists; a locale with no content file yet has nothing to check here (the
  // missing-file error above already covers it)
  const environmentsByLocale = new Map<Locale, ContentEnvironment[]>()

  // Read each declared locale's content file
  for (const locale of requiredLocales) {
    // Where this variant's content lives
    const contentFile = `${slug}.${locale}.json`
    const contentPath = path.join(CONTENT_DIR, contentFile)

    // Nothing to check yet if the build hasn't produced this variant
    if (!fs.existsSync(contentPath)) {
      continue
    }

    // This variant's parsed document
    const { document }: { document: ContentDocument } = JSON.parse(
      fs.readFileSync(contentPath, 'utf-8')
    )

    // The nesting guard runs over each top-level block's own fields — the block itself is a legitimate
    // top-level environment, so only what it contains (body, solution, proof, ...) is searched
    for (const section of document.sections) {
      for (const block of section.text.content) {
        for (const value of Object.values(block)) {
          yield* validateNoNestedEnvironments(value, `${handoutContext} (${contentFile})`)
        }
      }
    }

    // Record this locale's top-level environments
    environmentsByLocale.set(locale, readTopLevelEnvironments(document))
  }

  // The declared locale every other one is compared against, and the rest
  const [firstLocale, ...restLocales] = [...environmentsByLocale.keys()]

  // Nothing loaded means nothing further to check
  if (firstLocale === undefined) {
    return
  }

  // The reference variant's environments
  const reference = environmentsByLocale.get(firstLocale)!

  // Every environment needs a non-empty id. The value comes from untyped JSON, so anything that isn't a string
  // is reported rather than handed to a string check that would throw on it.
  for (const [position, environment] of reference.entries()) {
    // Where this environment sits, for whichever error the checks below produce
    const environmentContext = `${handoutContext} ${environment.type} #${position + 1} (${slug}.${firstLocale}.json)`

    // A present-but-non-string id is a malformed file, not a missing field
    if (environment.id !== undefined && typeof environment.id !== 'string') {
      yield `❌ Non-string id ${JSON.stringify(environment.id)} for ${environmentContext}`
      continue
    }

    // Absent or blank reads as missing
    yield* validateRequiredField(environment.id, 'id', environmentContext)

    // An id has to carry a minted one's width and alphabet, which catches the hand-typed ones that would
    // otherwise outlive the mistake. A hand-typed id of exactly the right width still passes — width and
    // alphabet are all an id reveals about where it came from.
    if (typeof environment.id === 'string' && !ENVIRONMENT_ID_PATTERN.test(environment.id)) {
      yield `❌ Malformed id "${environment.id}" for ${environmentContext}: expected a 21-character nanoid`
    }
  }

  // No id may repeat within one handout
  yield* validateUniqueness(
    reference,
    (environment) => environment.id as string | undefined,
    (_environment) => `${handoutContext} (${slug}.${firstLocale}.json)`,
    'environment id'
  )

  // Every other variant must lay out the same sequence, in the same order
  for (const locale of restLocales) {
    // This variant's environments
    const variant = environmentsByLocale.get(locale)!

    // A different count already means the sequences disagree
    if (variant.length !== reference.length) {
      yield `❌ ${handoutContext}: ${locale} has ${variant.length} environments but ${firstLocale} has ${reference.length}`
      continue
    }

    // The first position, if any, where this variant's id or type differs from the reference
    const divergence = reference
      .map((environment, position) => ({
        position,
        reference: environment,
        variant: variant[position],
      }))
      .find(
        (entry) =>
          entry.reference.id !== entry.variant.id || entry.reference.type !== entry.variant.type
      )

    // A divergence means this variant's sequence disagrees with the reference
    if (divergence) {
      yield `❌ ${handoutContext}: at position ${divergence.position + 1}, ${firstLocale} has ` +
        `${divergence.reference.type} "${String(divergence.reference.id)}" but ${locale} has ` +
        `${divergence.variant.type} "${String(divergence.variant.id)}"`
    }
  }

  // Names are what a URL points at and each language writes its own, so unlike ids they are checked in every
  // variant rather than in the reference alone
  for (const [locale, environments] of environmentsByLocale) {
    // Each environment's name has to be usable as an anchor on its own page
    for (const [position, environment] of environments.entries()) {
      // Where this environment sits, for whichever error the checks below produce
      const environmentContext = `${handoutContext} ${environment.type} #${position + 1} (${slug}.${locale}.json)`

      // A present-but-non-string name is a malformed file, not a missing field
      if (environment.slug !== undefined && typeof environment.slug !== 'string') {
        yield `❌ Non-string slug ${JSON.stringify(environment.slug)} for ${environmentContext}`
        continue
      }

      // Absent or blank reads as missing
      yield* validateRequiredField(environment.slug, 'slug', environmentContext)

      // A name of any other shape would ship a link the browser can't resolve
      if (
        typeof environment.slug === 'string' &&
        !ENVIRONMENT_SLUG_PATTERN.test(environment.slug)
      ) {
        yield `❌ Malformed slug "${environment.slug}" for ${environmentContext}: expected lowercase alphanumeric words joined by single hyphens`
      }
    }

    // Two environments sharing a name would fight over one anchor, and only one of them would ever be reached
    yield* validateUniqueness(
      environments,
      (environment) => environment.slug as string | undefined,
      (_environment) => `${handoutContext} (${slug}.${locale}.json)`,
      'environment slug'
    )
  }
}

/**
 * Lists a document's top-level environments, in document order.
 *
 * @param document - The parsed content document to walk.
 *
 * @returns The environment blocks found at the top level of each section.
 */
function readTopLevelEnvironments(document: ContentDocument): ContentEnvironment[] {
  // Every top-level block across every section that's actually an environment
  return document.sections.flatMap((section) =>
    section.text.content.filter((block) =>
      HANDOUT_ENVIRONMENT_TYPES.includes(block.type as (typeof HANDOUT_ENVIRONMENT_TYPES)[number])
    )
  )
}

/**
 * Validates the handout content, collecting every error.
 *
 * @returns Every validation error found; empty when valid.
 */
function validate(): string[] {
  // Collect errors here
  const errors: string[] = []

  // Ensure the handouts.json exists
  if (!fs.existsSync(INDEX_PATH)) {
    // Bail with the single fatal error
    return ['❌ handouts.json not found']
  }

  // Parse handouts.json
  const { sections }: HandoutIndex = JSON.parse(fs.readFileSync(INDEX_PATH, 'utf-8'))

  // Collect all handouts for uniqueness checks
  const handouts = sections.flatMap((section) => section.handouts)

  // Check for duplicate IDs
  errors.push(
    ...validateUniqueness(
      handouts,
      (handout) => handout.id,
      (handout) => getDisplayName(handout),
      'id'
    )
  )

  // Check for duplicate file slugs (used as content filenames)
  errors.push(
    ...validateUniqueness(
      handouts,
      (handout) => getContentFileBasename(handout),
      (handout) => getDisplayName(handout),
      'fileSlug'
    )
  )

  // Check for duplicate slugs (per locale, only among handouts that support that locale)
  for (const locale of SUPPORTED_LOCALES) {
    // Filter to handouts that support this locale
    const handoutsForLocale = handouts.filter((handout) => supportsLocale(handout, locale))

    // Flag any duplicate slug within this locale
    errors.push(
      ...validateUniqueness(
        handoutsForLocale,
        (handout) => handout.slug[locale],
        (handout) => getDisplayName(handout),
        `slug.${locale}`
      )
    )
  }

  // Validate each section
  for (const section of sections) {
    // Human-readable section label for error messages
    const sectionContext = `section "${section.category[DEFAULT_LOCALE] || 'unknown'}"`

    // Validate that the section has a stable locale-independent key
    if (!section.categoryKey || typeof section.categoryKey !== 'string') {
      // Record the missing key
      errors.push(`${sectionContext}: missing required "categoryKey" field`)
    }

    // Validate category (always required for all locales)
    errors.push(
      ...validatePartialLocalizedString(
        section.category,
        'category',
        sectionContext,
        SUPPORTED_LOCALES
      )
    )

    // Validate each handout
    for (const handout of section.handouts) {
      // The locales this handout must have values for
      const requiredLocales = getHandoutLocales(handout)

      // Build a display name for error messages
      const handoutContext = getDisplayName(handout)

      // A declared-but-empty list leaves the handout supporting nothing, which every consumer reads as
      // "no content file", silently
      if (handout.languages?.length === 0) {
        errors.push(
          `❌ Empty languages list for ${handoutContext} — omit the field to support every locale`
        )
      }

      // Validate title
      errors.push(
        ...validatePartialLocalizedString(handout.title, 'title', handoutContext, requiredLocales)
      )

      // Validate slug (only for declared languages)
      errors.push(
        ...validatePartialLocalizedString(handout.slug, 'slug', handoutContext, requiredLocales)
      )

      // Reject slug keys for locales the handout isn't published in — a stray key would
      // make hreflang advertise a detail URL that 404s (never rendered)
      const strayLocales = Object.keys(handout.slug).filter(
        (locale) => !requiredLocales.includes(locale as Locale)
      )
      // One error per stray key
      errors.push(
        ...strayLocales.map(
          (strayLocale) =>
            `${handoutContext}: slug has key "${strayLocale}" not in its ` +
            `languages [${requiredLocales.join(', ')}]`
        )
      )

      // Validate description (only for declared languages)
      errors.push(
        ...validatePartialLocalizedString(
          handout.description,
          'description',
          handoutContext,
          requiredLocales
        )
      )

      // Validate id
      errors.push(...validateRequiredField(handout.id, 'id', handoutContext))

      // Validate authors
      errors.push(...validateRequiredArray(handout.authors, 'authors', handoutContext))

      // Validate the publish date
      errors.push(...validateDateFormat(handout.publishedAt, `${handoutContext} publishedAt`))

      // Validate the update date
      errors.push(...validateDateFormat(handout.updatedAt, `${handoutContext} updatedAt`))

      // An update can't predate the publication
      if (handout.publishedAt && handout.updatedAt && handout.updatedAt < handout.publishedAt) {
        // Record the reversed dates
        errors.push(
          `❌ updatedAt "${handout.updatedAt}" precedes publishedAt "${handout.publishedAt}" ` +
            `for ${handoutContext}`
        )
      }

      // Validate difficulty
      errors.push(...validateDifficulty(handout.difficulty, handoutContext))

      // The handout's hide-solutions switch, as authored
      const hideFlag = handout.hideSolutionsAndProofs

      // A quoted "false" or a 0/1 reads as a boolean to the eye but not to a consumer
      if (hideFlag !== undefined && typeof hideFlag !== 'boolean') {
        // Record the mistyped value
        errors.push(`❌ Non-boolean "hideSolutionsAndProofs" for ${handoutContext}`)
      }

      // The content filename stem shared across locales
      const slug = getContentFileBasename(handout)
      // Every declared locale must have a matching content file
      for (const locale of requiredLocales) {
        // The content file's name for this locale
        const contentFile = `${slug}.${locale}.json`
        // Its absolute path on disk
        const contentPath = path.join(CONTENT_DIR, contentFile)

        // Check if the content file exists
        if (!fs.existsSync(contentPath)) {
          // Record the missing file
          errors.push(`❌ Missing content file: ${contentFile} for ${handoutContext}`)
        }
      }

      // Every environment has an id, no id repeats within this handout, and every variant agrees on the
      // sequence — the invariant every consumer of environment ids relies on staying stable
      errors.push(...validateHandoutEnvironmentIds(handout, requiredLocales, handoutContext))
    }
  }

  // Build the set of content files the index expects (declared languages only)
  const expectedFiles = new Set<string>()
  // Walk every section...
  for (const section of sections) {
    // ...and every handout in it
    for (const handout of section.handouts) {
      // The content filename stem
      const slug = getContentFileBasename(handout)
      // One expected file per declared locale
      for (const locale of getHandoutLocales(handout)) {
        expectedFiles.add(`${slug}.${locale}.json`)
      }
    }
  }

  // Flag any content file the index doesn't reference
  errors.push(...validateNoOrphans(CONTENT_DIR, 'json', expectedFiles, 'handouts.json'))

  // The committed environment index must match what the content actually says. Gated on a clean run so far:
  // built from broken content, it would only add noise on top of errors that already explain the problem.
  if (errors.length === 0) {
    // The index as currently committed, or nothing when it's never been generated
    const committed = fs.existsSync(ENV_INDEX_PATH)
      ? fs.readFileSync(ENV_INDEX_PATH, 'utf-8')
      : null

    // The index a fresh rebuild would produce right now
    const built = JSON.stringify(toHandoutEnvIndex(collectAllHandoutEnvironments()))

    // The two must agree
    if (committed === null || JSON.stringify(JSON.parse(committed)) !== built) {
      errors.push(
        '❌ handout-env-index.json is stale — run `npm run handouts:index` and commit the result'
      )
    }
  }

  // Hand back every collected error
  return errors
}

// Run the validator and exit with its status
runValidator(
  {
    validating: 'handout translations',
    success: 'All handouts have complete translations!',
    failure: 'Handout validation failed.',
  },
  validate
)
