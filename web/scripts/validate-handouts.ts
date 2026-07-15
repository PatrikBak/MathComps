/**
 * Validates handout content structure:
 * - Every handout in handouts.json has matching .{locale}.json content files
 *   for its declared languages (or all locales when languages is absent)
 * - All localized fields have values for all declared languages
 *
 * Run with: tsx scripts/validate-handouts.ts
 */

import fs from 'fs'
import path from 'path'

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
import { runValidator, validateNoOrphans } from './validation-runner'

/** Directory containing handout content files */
const CONTENT_DIR = path.join(process.cwd(), 'src/content/handouts')

/** Path to handouts.json */
const INDEX_PATH = path.join(CONTENT_DIR, '../handouts.json')

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
