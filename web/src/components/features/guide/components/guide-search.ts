import Fuse, { type IFuseOptions } from 'fuse.js'

import { assertNever } from '@/components/shared/utils/assert-never'
import { isExternalHref } from '@/components/shared/utils/url-utils'
import type { Locale } from '@/i18n/i18n'

import type { GuideContent, GuidePage } from '../content/guide-content-types'
import type { GuideLabels } from '../content/guide-labels'
import { tileBehavior } from '../content/guide-tile-behavior'
import { resolveGuideDescriptionText } from './guide-rich-description-map'

/** Fields every search entry carries, whatever its behavior. */
type GuideSearchEntryCommon = {
  /** The deck page the entity lives on. */
  page: GuidePage
  /** The entity's stable id; also the deck deep-link target. */
  id: string
  /** The entity's title (an acronym or a localized name). */
  title: string
  /** A short context line (full name, kind + countries, level + country, or bucket). */
  subtitle: string
  /** The one-line description, inline markdown stripped; absent for a metadata-only entity. */
  description?: string
}

/** A result whose card opens a modal (detail bullets or a multi-link chooser). */
type GuideSearchModalEntry = GuideSearchEntryCommon & {
  /** Discriminator: the card opens a modal on reveal. */
  behavior: 'modal'
}

/** A result whose card is plain — no link, no modal. */
type GuideSearchStaticEntry = GuideSearchEntryCommon & {
  /** Discriminator: a plain card with nothing to open. */
  behavior: 'static'
}

/** A result whose card is a lone link, so the row also offers a direct open. */
export type GuideSearchLinkEntry = GuideSearchEntryCommon & {
  /** Discriminator: the card is a lone link. */
  behavior: 'link'
  /** The link target. */
  href: string
  /** Whether the target is external versus an internal route. */
  isExternal: boolean
}

/** One searchable guide entity, tagged by its card's behavior in the deck. */
export type GuideSearchEntry = GuideSearchModalEntry | GuideSearchStaticEntry | GuideSearchLinkEntry

/** An entry's behavior fields: the tag, plus the link target when it's a lone link. */
type BehaviorPart =
  | Pick<GuideSearchModalEntry, 'behavior'>
  | Pick<GuideSearchStaticEntry, 'behavior'>
  | Pick<GuideSearchLinkEntry, 'behavior' | 'href' | 'isExternal'>

// Derive an entity's behavior fields from its detail + link counts, attaching the lone link's target.
const behaviorPart = (detailCount: number, links: { url: string }[]): BehaviorPart => {
  // Apply the shared classification rule
  const behavior = tileBehavior(detailCount, links.length)
  // Carry the lone link's target on the link case; the others are tag-only
  switch (behavior) {
    // A modal card needs only its tag
    case 'modal':
      return { behavior }
    // A lone link carries its target + whether it's external
    case 'link':
      return { behavior, href: links[0].url, isExternal: isExternalHref(links[0].url) }
    // A static card needs only its tag
    case 'static':
      return { behavior }
    // Exhaustive: a new behavior becomes a compile error
    default:
      return assertNever(behavior)
  }
}

/**
 * Flatten every searchable guide entity into one localized index. The page is implicit in the source
 * array; titles, subtitles, and descriptions are resolved to the active locale and the entity's tile
 * behavior is precomputed so a result knows which secondary affordance to offer.
 *
 * @param locale The active locale to resolve localized fields into.
 * @param labels The localized enum label maps (kind, bucket, school level).
 * @param content The guide content to index.
 * @returns The flat, locale-resolved search index.
 */
export function buildGuideSearchIndex(
  locale: Locale,
  labels: GuideLabels,
  content: GuideContent
): GuideSearchEntry[] {
  // International competitions: the full name is the subtitle; detail bullets make every one a modal
  const olympiad: GuideSearchEntry[] = content.internationalCompetitions.map((competition) => ({
    page: 'olympiad',
    id: competition.id,
    title: competition.acronym,
    subtitle: competition.fullName,
    description: resolveGuideDescriptionText(competition.description, locale),
    ...behaviorPart(competition.details.length, competition.links),
  }))

  // Other competitions: kind + countries make the subtitle; links decide modal/link/static
  const other: GuideSearchEntry[] = content.otherCompetitions.map((competition) => ({
    page: 'other',
    id: competition.id,
    title: competition.title[locale],
    subtitle: [labels.kind[competition.kind], ...competition.countries].join(' · '),
    description: resolveGuideDescriptionText(competition.description, locale),
    ...behaviorPart(0, competition.links),
  }))

  // Seminars: level + countries make the subtitle; a link-only seminar carries no description
  const seminars: GuideSearchEntry[] = content.seminars.map((seminar) => ({
    page: 'seminars',
    id: seminar.id,
    title: seminar.title,
    subtitle: [labels.schoolLevel[seminar.level], ...seminar.countries].join(' · '),
    description: seminar.description
      ? resolveGuideDescriptionText(seminar.description, locale)
      : undefined,
    ...behaviorPart(0, seminar.links),
  }))

  // Resources: a full name or the bucket name makes the subtitle; links decide modal/link/static
  const resources: GuideSearchEntry[] = content.resources.map((resource) => ({
    page: 'resources',
    id: resource.id,
    title: resource.title[locale],
    subtitle: resource.fullName ?? labels.bucket[resource.bucket],
    description: resolveGuideDescriptionText(resource.description, locale),
    ...behaviorPart(0, resource.links),
  }))

  // One flat index across the four card-bearing pages
  return [...olympiad, ...other, ...seminars, ...resources]
}

// Fuzzy, diacritics-insensitive matching tuned for a small as-you-type corpus: title outweighs the
// subtitle, which outweighs the description; location is ignored so a hit anywhere counts.
const FUSE_OPTIONS: IFuseOptions<GuideSearchEntry> = {
  keys: [
    { name: 'title', weight: 0.6 },
    { name: 'subtitle', weight: 0.3 },
    { name: 'description', weight: 0.1 },
  ],
  ignoreDiacritics: true,
  ignoreLocation: true,
  threshold: 0.35,
  minMatchCharLength: 2,
}

/**
 * Build the Fuse matcher over a prepared index.
 *
 * @param index The flat search index to match against.
 * @returns A configured Fuse instance.
 */
export function makeGuideFuse(index: GuideSearchEntry[]): Fuse<GuideSearchEntry> {
  // One matcher over the index, using the shared options
  return new Fuse(index, FUSE_OPTIONS)
}

/**
 * Run a query through the matcher, best match first.
 *
 * @param fuse The matcher built by {@link makeGuideFuse}.
 * @param query The raw user query.
 * @returns The matching entries, relevance-ranked; empty for a blank query.
 */
export function searchGuide(fuse: Fuse<GuideSearchEntry>, query: string): GuideSearchEntry[] {
  // Trim the raw query
  const trimmed = query.trim()
  // A blank query matches nothing
  if (!trimmed) return []
  // Fuse returns results already score-ordered; hand back just the items
  return fuse.search(trimmed).map((result) => result.item)
}
