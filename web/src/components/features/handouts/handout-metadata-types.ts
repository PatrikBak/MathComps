import type { Locale, LocalizedString } from '@/i18n/i18n'

/**
 * Type definitions for handout documents loaded from the handout index JSON file.
 * Do not modify the structure without coordinating with the handout index JSON schema.
 */

/**
 * A handout that is planned but not yet available.
 */
type PlannedHandoutMetadata = {
  /** Discriminator */
  status: 'planned'
  /** Localized display title shown in the handouts list */
  title: LocalizedString
}

/**
 * A handout that is fully available with content.
 */
export type ReadyHandoutMetadata = {
  /** Discriminator */
  status: 'ready'
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
  /** List of author names (not localized - names stay as-is) */
  authors: string[]
  /** Whether the handout appears in the public listing (defaults to true when absent) */
  public?: boolean
}

/**
 * Union type representing any handout metadata.
 */
export type HandoutMetadata = PlannedHandoutMetadata | ReadyHandoutMetadata

/**
 * Type guard to check if a handout is ready (has content).
 */
export function isReadyHandout(handout: HandoutMetadata): handout is ReadyHandoutMetadata {
  return handout.status === 'ready'
}

/**
 * Type guard to check if a handout is ready and publicly listed.
 * Handouts without an explicit `public` field are considered public.
 */
export function isPublicHandout(handout: HandoutMetadata): handout is ReadyHandoutMetadata {
  // A handout is public when it is ready and not explicitly marked as non-public
  return isReadyHandout(handout) && handout.public !== false
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
  // Planned handouts are always available in all locales
  if (!isReadyHandout(handout)) return true

  // Ready handouts without a languages restriction support all locales
  if (!handout.languages) return true

  // Check if the locale is in the declared languages list
  return handout.languages.includes(locale)
}

/**
 * Returns the canonical base filename used for content JSON files.
 * Uses the explicit `fileSlug` if set, otherwise falls back to the English slug.
 *
 * @param handout - The ready handout metadata.
 *
 * @returns The base filename for content files (e.g., "factorization" or "means").
 */
export function getContentFileBasename(handout: ReadyHandoutMetadata): string {
  // Use the explicit fileSlug when provided (required for handouts without an English slug)
  return handout.fileSlug ?? handout.slug.en
}

/**
 * Groups handouts by a high-level category (e.g., Algebra, Geometria).
 */
export type HandoutSection = {
  /** Localized category name */
  category: LocalizedString
  /** Array of handout entries in this category (planned or ready) */
  handouts: HandoutMetadata[]
}
