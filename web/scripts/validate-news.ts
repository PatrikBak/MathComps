/**
 * Validates news content structure:
 * - Every news entry in news.json has matching .{locale}.mdx content files
 * - All localized fields have values for all supported locales
 * - Required fields (id, slug, date, category) are present
 * - Category is a known value, and the cover is valid (registered icon, existing figure file, or non-empty equation)
 *
 * Run with: npx tsx scripts/validate-news.ts
 */

import fs from 'fs'
import path from 'path'

import { NEWS_ICONS } from '../src/components/features/news/news-icons'
import type { NewsCover, NewsIndexEntry } from '../src/components/features/news/types'
import { NEWS_CATEGORIES } from '../src/components/features/news/types'
import { DEFAULT_LOCALE, SUPPORTED_LOCALES } from '../src/i18n/i18n'
import {
  validateDateFormat,
  validateLocalizedString,
  validateMembership,
  validateRequiredField,
  validateUniqueness,
} from '../src/lib/content-validation'
import { runValidator, validateNoOrphans } from './validation-runner'

/** Directory containing news content files */
const CONTENT_DIR = path.join(process.cwd(), 'src/content/news')

/** Path to news.json */
const INDEX_PATH = path.join(CONTENT_DIR, '../news.json')

/** Public directory holding the figure cover SVGs. */
const PUBLIC_DIR = path.join(process.cwd(), 'public')

/**
 * Validates a news entry's cover. news.json is untyped at the JSON boundary, so a missing cover, a
 * misnamed icon, a dangling figure path, or an empty equation would otherwise go uncaught.
 *
 * @param cover - The cover to validate; required on every entry.
 * @param context - Description of the containing entry (for error messages).
 *
 * @yields Error messages for any validation failures.
 */
function* validateCover(cover: NewsCover | undefined, context: string): Generator<string> {
  // Cover is mandatory
  if (!cover) {
    yield `❌ Missing cover for ${context}`
    // Nothing more to check on a missing cover
    return
  }

  // Each variant validates its own required field
  switch (cover.kind) {
    case 'figure':
      // The SVG must actually exist under /public, mirroring the content-file check
      if (!fs.existsSync(path.join(PUBLIC_DIR, cover.src))) {
        yield `❌ Missing cover figure "${cover.src}" for ${context}`
      }
      break

    case 'equation':
      // An empty expression would render a blank cover
      if (!cover.latex || cover.latex.trim() === '') {
        yield `❌ Empty cover equation for ${context}`
      }
      break

    case 'icon':
      // The name must be a key in the icon registry
      if (!(cover.name in NEWS_ICONS)) {
        yield `❌ Unknown cover icon "${cover.name}" for ${context}`
      }
      break

    default:
      // An unrecognized kind slipped past the untyped JSON
      yield `❌ Unknown cover kind "${(cover as { kind: string }).kind}" for ${context}`
  }
}

/**
 * Validates the news content, collecting every error.
 *
 * @returns Every validation error found; empty when valid.
 */
function validate(): string[] {
  // Collect errors here
  const errors: string[] = []

  // Ensure the news.json exists
  if (!fs.existsSync(INDEX_PATH)) {
    // Bail with the single fatal error
    return ['❌ news.json not found']
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
    // Human-readable label for error messages
    const context = `news article "${entry.title?.[DEFAULT_LOCALE] || entry.slug || 'unknown'}"`

    // Validate required string fields
    errors.push(...validateRequiredField(entry.id, 'id', context))
    errors.push(...validateRequiredField(entry.slug, 'slug', context))
    errors.push(...validateRequiredField(entry.category, 'category', context))

    // Validate title (LocalizedString)
    errors.push(...validateLocalizedString(entry.title, 'title', context))

    // Validate date format
    errors.push(...validateDateFormat(entry.date, context))

    // Validate the category is one of the known values (it drives the badge color); a missing one is
    // already reported above, so only check membership when present
    if (entry.category) {
      errors.push(...validateMembership(entry.category, NEWS_CATEGORIES, 'category', context))
    }

    // Validate the cover (icon name registered, figure file present, equation non-empty)
    errors.push(...validateCover(entry.cover, context))

    // Validate content files exist for all locales
    if (entry.slug) {
      // One file per supported locale
      for (const locale of SUPPORTED_LOCALES) {
        // Construct the content file path
        const contentFile = `${entry.slug}.${locale}.mdx`
        const contentPath = path.join(CONTENT_DIR, contentFile)

        // Check if the content file exists
        if (!fs.existsSync(contentPath)) {
          // Record the missing file
          errors.push(`❌ Missing content file: ${contentFile} for ${context}`)
        }
      }
    }
  }

  // Build the set of content files the index expects
  const expectedFiles = new Set<string>()
  // Walk every entry
  for (const entry of entries) {
    // Only entries with a slug expect content files
    if (entry.slug) {
      // One expected file per supported locale
      for (const locale of SUPPORTED_LOCALES) {
        expectedFiles.add(`${entry.slug}.${locale}.mdx`)
      }
    }
  }

  // Flag any content file the index doesn't reference
  errors.push(...validateNoOrphans(CONTENT_DIR, 'mdx', expectedFiles, 'news.json'))

  // Hand back every collected error
  return errors
}

// Run the validator and exit with its status
runValidator(
  {
    validating: 'news translations',
    success: 'All news articles have complete translations!',
    failure: 'News validation failed.',
  },
  validate
)
