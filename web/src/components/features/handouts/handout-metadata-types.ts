import type { Locale, LocalizedString } from '@/i18n/i18n'

/**
 * Type definitions for handout documents loaded from the handout index JSON file.
 * Do not modify the structure without coordinating with the handout index JSON schema.
 */

/** The difficulty levels, low to high */
export const HANDOUT_DIFFICULTY_LEVELS = [1, 2, 3] as const

/** A handout's difficulty on the {@link HANDOUT_DIFFICULTY_LEVELS} scale */
export type HandoutDifficulty = (typeof HANDOUT_DIFFICULTY_LEVELS)[number]

/**
 * A handout: a study material available with content.
 */
export type HandoutMetadata = {
  /** Permanent unique identifier (nanoid) for comments and references */
  id: string
  /** Subset of locales this handout is available in (defaults to all when absent) */
  languages?: Locale[]
  /**
   * Base filename for content files (e.g., "means" for means.cs.json).
   * Defaults to slug.en when absent. Required when the handout has no English slug.
   */
  fileSlug?: string
  /** Localized URL-friendly identifier for routing */
  slug: LocalizedString
  /** Localized display title shown in the handouts list */
  title: LocalizedString
  /** Localized SEO/OG description for metadata */
  description: LocalizedString
  /** Difficulty level, low to high */
  difficulty: HandoutDifficulty
  /** List of author names (not localized - names stay as-is) */
  authors: string[]
  /** Date the handout was first published (YYYY-MM-DD) */
  publishedAt: string
  /** Date the handout's content was last meaningfully changed (YYYY-MM-DD) */
  updatedAt: string
  /** Whether the handout appears in the public listing (defaults to true when absent) */
  public?: boolean
}

/**
 * Groups handouts by a high-level category (e.g., Algebra, Geometry, etc.)
 */
export type HandoutSection = {
  /** Stable locale-independent identifier for the section (e.g., "number-theory") */
  categoryKey: string
  /** Localized category name */
  category: LocalizedString
  /** Array of handout entries in this category */
  handouts: HandoutMetadata[]
}

/**
 * Root structure of the handouts.json index file.
 */
export type HandoutIndex = {
  /** Handouts grouped by category */
  sections: HandoutSection[]
}

/**
 * Whether a handout appears in the public listing.
 * Handouts without an explicit `public` field are considered public.
 *
 * @param handout - The handout metadata to check.
 *
 * @returns True when the handout is publicly listed.
 */
export function isPublicHandout(handout: HandoutMetadata): boolean {
  // A handout is public unless it is explicitly marked otherwise
  return handout.public !== false
}

/**
 * Checks whether a handout supports the given locale.
 * When `languages` is absent, the handout supports all locales.
 *
 * @param handout - The handout metadata to check.
 * @param locale - The locale to check support for.
 *
 * @returns True if the handout is available in the given locale.
 */
export function supportsLocale(handout: HandoutMetadata, locale: Locale): boolean {
  // Without a languages restriction, the handout supports all locales
  if (!handout.languages) return true

  // Otherwise the locale must be in the declared languages list
  return handout.languages.includes(locale)
}

/**
 * Returns the canonical base filename used for content JSON files.
 * Uses the explicit `fileSlug` if set, otherwise falls back to the English slug.
 *
 * @param handout - The handout metadata.
 *
 * @returns The base filename for content files (e.g., "factorization" or "means").
 */
export function getContentFileBasename(handout: HandoutMetadata): string {
  // Use the explicit fileSlug when provided (required for handouts without an English slug)
  return handout.fileSlug ?? handout.slug.en
}
