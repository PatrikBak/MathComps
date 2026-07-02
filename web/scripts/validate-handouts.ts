/**
 * Validates handout content structure:
 * - Every ready handout in handouts.json has matching .{locale}.json content files
 *   for its declared languages (or all locales when languages is absent)
 * - All localized fields have values for all declared languages
 *
 * Run with: tsx scripts/validate-handouts.ts
 */

import fs from 'fs'
import path from 'path'

import {
  getContentFileBasename,
  HANDOUT_SOURCES,
  type HandoutIndex,
  isReadyHandout,
  type ReadyHandoutMetadata,
  supportsLocale,
} from '../src/components/features/handouts/handout-metadata-types'
import { DEFAULT_LOCALE, type Locale, SUPPORTED_LOCALES } from '../src/i18n/i18n'
import {
  validateMembership,
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
function getHandoutLocales(handout: { languages?: Locale[] }): readonly Locale[] {
  return handout.languages ?? SUPPORTED_LOCALES
}

/**
 * Returns a human-readable title for error messages, using the first declared language.
 *
 * @param handout - The handout metadata to extract a display name from.
 *
 * @returns A formatted string like `handout "Průměry"`.
 */
function getDisplayName(handout: { title: Record<string, string>; languages?: Locale[] }): string {
  const locale = handout.languages?.[0] ?? DEFAULT_LOCALE
  return `handout "${handout.title[locale] ?? 'unknown'}"`
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

  // Collect all ready handouts for uniqueness checks
  const readyHandouts = sections
    .flatMap((section) => section.handouts)
    .filter(isReadyHandout) as ReadyHandoutMetadata[]

  // Check for duplicate IDs
  errors.push(
    ...validateUniqueness(
      readyHandouts,
      (handout) => handout.id,
      (handout) => getDisplayName(handout),
      'id'
    )
  )

  // Check for duplicate file slugs (used as content filenames)
  errors.push(
    ...validateUniqueness(
      readyHandouts,
      (handout) => getContentFileBasename(handout),
      (handout) => getDisplayName(handout),
      'fileSlug'
    )
  )

  // Check for duplicate slugs (per locale, only among handouts that support that locale)
  for (const locale of SUPPORTED_LOCALES) {
    // Filter to handouts that support this locale
    const handoutsForLocale = readyHandouts.filter((handout) => supportsLocale(handout, locale))

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
      // Determine which locales this handout must have values for
      const requiredLocales = isReadyHandout(handout)
        ? getHandoutLocales(handout)
        : SUPPORTED_LOCALES

      // Build a display name for error messages
      const handoutContext = getDisplayName(handout)

      // Validate title (common to both planned and ready handouts)
      errors.push(
        ...validatePartialLocalizedString(handout.title, 'title', handoutContext, requiredLocales)
      )

      // Validate ready-specific fields
      if (isReadyHandout(handout)) {
        // isReadyHandout already narrowed; pin the ready type
        const readyHandout = handout as ReadyHandoutMetadata

        // Validate slug (only for declared languages)
        errors.push(
          ...validatePartialLocalizedString(
            readyHandout.slug,
            'slug',
            handoutContext,
            requiredLocales
          )
        )

        // Reject slug keys for locales the handout isn't published in — a stray key would
        // make hreflang advertise a detail URL that 404s (never rendered)
        const strayLocales = Object.keys(readyHandout.slug).filter(
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
            readyHandout.description,
            'description',
            handoutContext,
            requiredLocales
          )
        )

        // Validate id
        errors.push(...validateRequiredField(readyHandout.id, 'id', handoutContext))

        // Validate authors
        errors.push(...validateRequiredArray(readyHandout.authors, 'authors', handoutContext))

        // Validate source is one of the known values
        errors.push(
          ...validateMembership(readyHandout.source, HANDOUT_SOURCES, 'source', handoutContext)
        )

        // The content filename stem shared across locales
        const slug = getContentFileBasename(readyHandout)
        // Every declared locale must have a matching content file
        for (const locale of requiredLocales) {
          // Construct the content file path
          const contentFile = `${slug}.${locale}.json`
          const contentPath = path.join(CONTENT_DIR, contentFile)

          // Check if the content file exists
          if (!fs.existsSync(contentPath)) {
            // Record the missing file
            errors.push(`❌ Missing content file: ${contentFile} for ${handoutContext}`)
          }
        }
      }
    }
  }

  // Build the set of content files the index expects (declared languages only)
  const expectedFiles = new Set<string>()
  // Walk every handout in every section
  for (const section of sections) {
    for (const handout of section.handouts) {
      // Only ready handouts have content files, and only for their declared languages
      if (isReadyHandout(handout)) {
        // The content filename stem
        const slug = getContentFileBasename(handout)
        // One expected file per declared locale
        for (const locale of getHandoutLocales(handout)) {
          expectedFiles.add(`${slug}.${locale}.json`)
        }
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
