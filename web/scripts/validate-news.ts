/**
 * Validates news content structure:
 * - Every news entry in news.json has matching .{locale}.mdx content files
 * - All localized fields have values for all supported locales
 * - Required fields (id, slug, date, category, author) are present
 *
 * Run with: npx tsx scripts/validate-news.ts
 */

import fs from 'fs'
import path from 'path'

import type { NewsIndexEntry } from '../src/components/features/news/types'
import { DEFAULT_LOCALE, SUPPORTED_LOCALES } from '../src/i18n/i18n'
import {
  validateDateFormat,
  validateLocalizedString,
  validateRequiredField,
  validateUniqueness,
} from '../src/lib/content-validation'

/** Directory containing news content files */
const CONTENT_DIR = path.join(process.cwd(), 'src/content/news')

/** Path to news.json */
const INDEX_PATH = path.join(CONTENT_DIR, '../news.json')

/** Main validation logic */
function validate(): boolean {
  // We'll push errors into this array
  const errors: string[] = []

  // Ensure the news.json exists
  if (!fs.existsSync(INDEX_PATH)) {
    console.error('❌ news.json not found')
    return false
  }

  // Parse the index file
  const entries: NewsIndexEntry[] = JSON.parse(fs.readFileSync(INDEX_PATH, 'utf-8'))

  // Check for duplicate IDs
  errors.push(
    ...validateUniqueness(
      entries,
      (entry) => entry.id,
      (entry) => `news article "${entry.title?.[DEFAULT_LOCALE] || entry.slug || 'unknown'}"`,
      'id'
    )
  )

  // Check for duplicate slugs
  errors.push(
    ...validateUniqueness(
      entries,
      (entry) => entry.slug,
      (entry) => `news article "${entry.title?.[DEFAULT_LOCALE] || entry.slug || 'unknown'}"`,
      'slug'
    )
  )

  // Validate each entry
  for (const entry of entries) {
    // A string for logging
    const context = `news article "${entry.title?.[DEFAULT_LOCALE] || entry.slug || 'unknown'}"`

    // Validate required string fields
    errors.push(...validateRequiredField(entry.id, 'id', context))
    errors.push(...validateRequiredField(entry.slug, 'slug', context))
    errors.push(...validateRequiredField(entry.category, 'category', context))
    errors.push(...validateRequiredField(entry.author, 'author', context))

    // Validate title (LocalizedString)
    errors.push(...validateLocalizedString(entry.title, 'title', context))

    // Validate date format
    errors.push(...validateDateFormat(entry.date, context))

    // Validate content files exist for all locales
    if (entry.slug) {
      for (const locale of SUPPORTED_LOCALES) {
        // Construct the content file path
        const contentFile = `${entry.slug}.${locale}.mdx`
        const contentPath = path.join(CONTENT_DIR, contentFile)

        // Check if the content file exists
        if (!fs.existsSync(contentPath)) {
          errors.push(`❌ Missing content file: ${contentFile} for ${context}`)
        }
      }
    }
  }

  // Check for orphan content files (files not referenced in news.json)
  const contentFiles = fs
    .readdirSync(CONTENT_DIR)
    .filter((file) => new RegExp(`^.+\\.(${SUPPORTED_LOCALES.join('|')})\\.mdx$`).test(file))

  // Build set of expected content files
  const expectedFiles = new Set<string>()
  for (const entry of entries) {
    if (entry.slug) {
      for (const locale of SUPPORTED_LOCALES) {
        expectedFiles.add(`${entry.slug}.${locale}.mdx`)
      }
    }
  }

  // Check for orphans
  for (const file of contentFiles) {
    if (!expectedFiles.has(file)) {
      errors.push(`⚠️  Orphan content file not referenced in news.json: ${file}`)
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
console.log('🔍 Validating news translations...\n')

// Validate and exit
if (validate()) {
  console.log('✅ All news articles have complete translations!')
  process.exit(0)
} else {
  console.log('\n⚠️  News validation failed.')
  process.exit(1)
}
