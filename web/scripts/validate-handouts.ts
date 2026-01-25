/**
 * Validates handout content structure:
 * - Every ready handout in handouts.json has matching .{locale}.json content files
 * - All localized fields have values for all supported locales
 *
 * Run with: tsx scripts/validate-handouts.ts
 */

import fs from 'fs'
import path from 'path'

import {
  type HandoutSection,
  isReadyHandout,
  type ReadyHandoutMetadata,
} from '../src/components/features/handouts/handout-metadata-types'
import { DEFAULT_LOCALE, SUPPORTED_LOCALES } from '../src/i18n/i18n'
import {
  validateLocalizedString,
  validateRequiredArray,
  validateRequiredField,
  validateUniqueness,
} from '../src/lib/content-validation'

/** Directory containing handout content files */
const CONTENT_DIR = path.join(process.cwd(), 'src/content/handouts')

/** Path to handouts.json */
const INDEX_PATH = path.join(CONTENT_DIR, '../handouts.json')

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
  const sections: HandoutSection[] = JSON.parse(fs.readFileSync(INDEX_PATH, 'utf-8'))

  // Collect all ready handouts for uniqueness checks
  const readyHandouts = sections
    .flatMap((section) => section.handouts)
    .filter(isReadyHandout) as ReadyHandoutMetadata[]

  // Check for duplicate IDs
  errors.push(
    ...validateUniqueness(
      readyHandouts,
      (handout) => handout.id,
      (handout) => `handout "${handout.title[DEFAULT_LOCALE] || 'unknown'}"`,
      'id'
    )
  )

  // Check for duplicate English slugs (used as content filenames)
  errors.push(
    ...validateUniqueness(
      readyHandouts,
      (handout) => handout.slug.en,
      (handout) => `handout "${handout.title[DEFAULT_LOCALE] || 'unknown'}"`,
      'slug.en (filename)'
    )
  )

  // Check for duplicate slugs (per locale)
  for (const locale of SUPPORTED_LOCALES) {
    errors.push(
      ...validateUniqueness(
        readyHandouts,
        (handout) => handout.slug[locale],
        (handout) => `handout "${handout.title[DEFAULT_LOCALE] || 'unknown'}"`,
        `slug.${locale}`
      )
    )
  }

  // Validate each section
  for (const section of sections) {
    // A string for logging
    const sectionContext = `section "${section.category[DEFAULT_LOCALE] || 'unknown'}"`

    // Validate category
    errors.push(...validateLocalizedString(section.category, 'category', sectionContext))

    // Validate each handout
    for (const handout of section.handouts) {
      // A string for logging
      const handoutContext = `handout "${handout.title[DEFAULT_LOCALE] || 'unknown'}"`

      // Validate common fields
      errors.push(...validateLocalizedString(handout.slug, 'slug', handoutContext))
      errors.push(...validateLocalizedString(handout.title, 'title', handoutContext))

      // Validate ready-specific fields
      if (isReadyHandout(handout)) {
        // Safe cast
        const readyHandout = handout as ReadyHandoutMetadata

        // Validate description
        errors.push(
          ...validateLocalizedString(readyHandout.description, 'description', handoutContext)
        )

        // Validate id
        errors.push(...validateRequiredField(readyHandout.id, 'id', handoutContext))

        // Validate authors
        errors.push(...validateRequiredArray(readyHandout.authors, 'authors', handoutContext))

        // Validate content files exist for all locales
        // Content files use English slug as filename (e.g., "factorization.sk.json")
        for (const locale of SUPPORTED_LOCALES) {
          // Construct the content file path using English slug
          const contentFile = `${readyHandout.slug.en}.${locale}.json`
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
        for (const locale of SUPPORTED_LOCALES) {
          expectedFiles.add(`${handout.slug.en}.${locale}.json`)
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
