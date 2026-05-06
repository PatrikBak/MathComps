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
  type HandoutEvent,
  type HandoutIndex,
  isReadyHandout,
  type ReadyHandoutMetadata,
  supportsLocale,
} from '../src/components/features/handouts/handout-metadata-types'
import { DEFAULT_LOCALE, type Locale, SUPPORTED_LOCALES } from '../src/i18n/i18n'
import {
  validatePartialLocalizedString,
  validateRequiredArray,
  validateRequiredField,
  validateUniqueness,
} from '../src/lib/content-validation'

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

/** Main validation logic */
function validate(): boolean {
  // We'll push errors into this array
  const errors: string[] = []

  // Ensure the handouts.json exists
  if (!fs.existsSync(INDEX_PATH)) {
    errors.push('❌ handouts.json not found')
    return false
  }

  // Parse handouts.json
  const { sections, events }: HandoutIndex = JSON.parse(fs.readFileSync(INDEX_PATH, 'utf-8'))

  // Build a set of known event IDs for cross-reference validation
  const knownEventIds = new Set(events.map((event: HandoutEvent) => event.id))

  // Validate each event entry
  for (const event of events) {
    const eventContext = `event "${event.id}"`
    errors.push(...validateRequiredField(event.id, 'id', eventContext))
    errors.push(
      ...validatePartialLocalizedString(event.name, 'name', eventContext, SUPPORTED_LOCALES)
    )
  }

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

  // Allowed source values
  const allowedSources = new Set(HANDOUT_SOURCES)

  // Validate each section
  for (const section of sections) {
    // A string for logging
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
        // Safe cast
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
        if (!allowedSources.has(readyHandout.source)) {
          errors.push(
            `${handoutContext}: unknown source "${readyHandout.source}" (expected one of: ${[...allowedSources].join(', ')})`
          )
        }

        // Validate eventId references a known event
        if (readyHandout.eventId !== undefined && !knownEventIds.has(readyHandout.eventId)) {
          errors.push(
            `${handoutContext}: eventId "${readyHandout.eventId}" does not match any entry in the events array`
          )
        }

        // Validate content files exist for declared languages
        const slug = getContentFileBasename(readyHandout)
        for (const locale of requiredLocales) {
          // Construct the content file path
          const contentFile = `${slug}.${locale}.json`
          const contentPath = path.join(CONTENT_DIR, contentFile)

          // Check if the content file exists
          if (!fs.existsSync(contentPath)) {
            errors.push(`❌ Missing content file: ${contentFile} for ${handoutContext}`)
          }
        }
      }
    }
  }

  // Check for orphan content files (files not referenced in handouts.json)
  const contentFiles = fs
    .readdirSync(CONTENT_DIR)
    .filter((file) => new RegExp(`^.+\\.(${SUPPORTED_LOCALES.join('|')})\\.json$`).test(file))

  // Build set of expected content files
  const expectedFiles = new Set<string>()
  for (const section of sections) {
    for (const handout of section.handouts) {
      if (isReadyHandout(handout)) {
        // Only expect content files for declared languages
        const slug = getContentFileBasename(handout)
        for (const locale of getHandoutLocales(handout)) {
          expectedFiles.add(`${slug}.${locale}.json`)
        }
      }
    }
  }

  // Check for orphans
  for (const file of contentFiles) {
    if (!expectedFiles.has(file)) {
      errors.push(`⚠️  Orphan content file not referenced in handouts.json: ${file}`)
    }
  }

  // Print errors
  for (const error of errors) {
    console.error(error)
  }

  // Return valid if no errors
  return errors.length === 0
}

// Run validation
console.log('🔍 Validating handout translations...\n')

// Validate and exit
if (validate()) {
  console.log('✅ All handouts have complete translations!')
  process.exit(0)
} else {
  console.log('\n❌ Handout validation failed.')
  process.exit(1)
}
