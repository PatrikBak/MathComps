import type { Locale, LocalizedString } from '@/i18n/i18n'

/**
 * Type definitions for handout documents loaded from the handout index JSON file.
 * Do not modify the structure without coordinating with the handout index JSON schema.
 */

/**
 * All handout sources in their canonical display order.
 *
 * - `matikaCesku` — written for Matika Česku math circles and online course.
 * - `events` — originally used at events/camps; carries an `eventId` on ready handouts.
 */
export const HANDOUT_SOURCES = ['matikaCesku', 'events'] as const

/**
 * Origin/source of a handout. Drives the source badge on each card and the
 * source filter chip row on the listing page.
 */
export type HandoutSource = (typeof HANDOUT_SOURCES)[number]

/**
 * A named event (camp, competition, etc.) that handouts can reference.
 */
export type HandoutEvent = {
  /** Stable identifier used as a foreign key from handouts */
  id: string
  /** Localized display name of the event */
  name: LocalizedString
  /** Optional localized longer-form description of the event */
  description?: LocalizedString
  /** Optional external URL for the event homepage */
  link?: string
}

/**
 * Fields common to all handout statuses.
 */
type HandoutMetadataBase = {
  /** Origin of the handout (drives the source badge and filter row) */
  source: HandoutSource
  /** Localized display title shown in the handouts list */
  title: LocalizedString
}

/**
 * A handout that is planned but not yet available.
 */
type PlannedHandoutMetadata = HandoutMetadataBase & {
  /** Discriminator */
  status: 'planned'
}

/**
 * A handout that is fully available with content.
 */
export type ReadyHandoutMetadata = HandoutMetadataBase & {
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
  /**
   * ID of the {@link HandoutEvent} this handout was used at.
   * Only meaningful for `source === 'events'` handouts; omitted otherwise.
   */
  eventId?: string
  /** Whether the handout appears in the public listing (defaults to true when absent) */
  public?: boolean
}

/**
 * Union type representing any handout metadata.
 */
export type HandoutMetadata = PlannedHandoutMetadata | ReadyHandoutMetadata

/**
 * Groups handouts by a high-level category (e.g., Algebra, Geometry, etc.)
 */
export type HandoutSection = {
  /** Stable locale-independent identifier for the section (e.g., "number-theory") */
  categoryKey: string
  /** Localized category name */
  category: LocalizedString
  /** Array of handout entries in this category (planned or ready) */
  handouts: HandoutMetadata[]
}

/**
 * Root structure of the handouts.json index file.
 */
export type HandoutIndex = {
  /** Named events that handouts can reference via `eventId` */
  events: HandoutEvent[]
  /** Handouts grouped by category */
  sections: HandoutSection[]
}

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
 * Looks up a {@link HandoutEvent} by its id from an events array.
 * Returns undefined when the handout has no eventId or the id is not found.
 *
 * @param handout - The ready handout metadata.
 * @param events - The full events array from the index.
 *
 * @returns The matching event, or undefined.
 */
export function resolveHandoutEvent(
  handout: ReadyHandoutMetadata,
  events: HandoutEvent[]
): HandoutEvent | undefined {
  // We need handouts with an event id
  if (!handout.eventId) return undefined

  // Look up the event from the event index
  return events.find((event) => event.id === handout.eventId)
}
