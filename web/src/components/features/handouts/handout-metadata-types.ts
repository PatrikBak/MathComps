import type { LocalizedString } from '@/i18n/i18n'

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
  /** Localized URL-friendly identifier for routing */
  slug: LocalizedString
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
  /** Localized URL-friendly identifier for routing */
  slug: LocalizedString
  /** Localized display title shown in the handouts list */
  title: LocalizedString
  /** Localized SEO/OG description for metadata */
  description: LocalizedString
  /** List of author names (not localized - names stay as-is) */
  authors: string[]
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
 * Groups handouts by a high-level category (e.g., Algebra, Geometria).
 */
export type HandoutSection = {
  /** Localized category name */
  category: LocalizedString
  /** Array of handout entries in this category (planned or ready) */
  handouts: HandoutMetadata[]
}
