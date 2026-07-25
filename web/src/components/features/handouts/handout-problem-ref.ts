import handoutIndex from '@/content/handouts.json'
import type { Locale, PartialLocalizedString } from '@/i18n/i18n'
import { SUPPORTED_LOCALES } from '@/i18n/i18n'

import type { HandoutEnvironmentType } from './handout-content-types'
import { HANDOUT_ENVIRONMENT_TYPES } from './handout-content-types'
import type { HandoutIndex } from './handout-metadata-types'
import { supportsLocale } from './handout-metadata-types'
import { buildEnvAnchorId } from './handout-utils'

/** The site's handout index. */
const index = handoutIndex as unknown as HandoutIndex

/**
 * A handout problem key broken into its parts. The `handout:` namespace and the closing
 * `-{type}-{number}` are fixed, so the content id (a nanoid that may itself contain hyphens) is whatever remains
 * between them.
 */
export type ParsedHandoutProblemKey = {
  /** The handout's permanent content id. */
  contentId: string
  /** The environment's type. */
  environmentType: HandoutEnvironmentType
  /** The environment's document-wide, per-type number. */
  environmentNumber: number
}

/**
 * Where a handout problem lives: the handout that holds it, and which environment within that handout it is.
 */
export type HandoutProblemRef = {
  /** The handout's display title in the requested locale. */
  handoutTitle: string
  /** The environment's type. */
  environmentType: HandoutEnvironmentType
  /** The environment's document-wide, per-type number. */
  environmentNumber: number
  /** The handout's URL slug in the requested locale, or null when it isn't published in that language. */
  handoutSlug: string | null
  /** The DOM anchor id of the problem within its handout page. */
  anchorId: string
}

/**
 * The pattern a handout problem key must match, anchored so the content id claims everything between the fixed
 * prefix and the trailing `-{type}-{number}`. The type alternation is read off the environment types themselves,
 * so it can't drift from them.
 */
const PROBLEM_KEY_PATTERN = new RegExp(
  `^handout:(.+)-(${HANDOUT_ENVIRONMENT_TYPES.join('|')})-(\\d+)$`
)

/**
 * Builds the stable key identifying one problem of a handout, namespaced so keys from different sources can't
 * collide. Keyed by the environment's identity (type plus document-wide number) rather than anything localized
 * or authored, so the key survives locale switches and title edits.
 *
 * @param contentId - The handout's permanent content id.
 * @param environmentType - The environment's type.
 * @param environmentNumber - The environment's document-wide, per-type number.
 *
 * @returns The problem key, e.g. `handout:AbC-123-problem-4`.
 */
export function buildHandoutProblemKey(
  contentId: string,
  environmentType: HandoutEnvironmentType,
  environmentNumber: number | string
): string {
  // The namespaced key, closing on the environment's identity
  return `handout:${contentId}-${environmentType}-${environmentNumber}`
}

/**
 * Parses a problem key back into its handout parts.
 *
 * @param problemKey - The stable, source-namespaced problem key.
 *
 * @returns The parsed parts, or null when the key is not a handout key.
 */
export function parseHandoutProblemKey(problemKey: string): ParsedHandoutProblemKey | null {
  // Match the fixed shape
  const match = PROBLEM_KEY_PATTERN.exec(problemKey)

  // A non-handout source or a malformed key matches nothing
  if (match === null) {
    return null
  }

  // The captured content id, environment type, and number
  const [, contentId, environmentType, environmentNumber] = match

  // The key's parts, the type narrowed by the alternation that matched it
  return {
    contentId,
    environmentType: environmentType as HandoutEnvironmentType,
    environmentNumber: Number(environmentNumber),
  }
}

/**
 * Resolves a problem key to its handout location, naming the handout in the given language and anchoring the exact
 * problem within it.
 *
 * @param problemKey - The stable, source-namespaced problem key.
 * @param locale - The locale to resolve the title and slug in.
 *
 * @returns The resolved location, or null when the key isn't a handout key or its handout is gone from the site.
 */
export function resolveHandoutProblemRef(
  problemKey: string,
  locale: Locale
): HandoutProblemRef | null {
  // Break the key into its handout parts
  const parsed = parseHandoutProblemKey(problemKey)

  // A key from another source names no handout
  if (parsed === null) {
    return null
  }

  // The handout the key points at, by its permanent content id
  const handout = index.sections
    .flatMap((section) => section.handouts)
    .find((candidate) => candidate.id === parsed.contentId)

  // A key can outlive the handout it points at
  if (handout === undefined) {
    return null
  }

  // A handout published in only some languages names itself only in those, so read the titles as the
  // partial map they really are
  const titles: PartialLocalizedString = handout.title

  // Its title in this language, falling back to whichever language does name it
  const handoutTitle =
    titles[locale] ?? SUPPORTED_LOCALES.map((candidate) => titles[candidate]).find(Boolean)

  // A handout that names itself in no language at all is indistinguishable from a missing one
  if (handoutTitle === undefined) {
    return null
  }

  // The handout, and the exact problem within it as a locale-stable anchor. Only a handout published in this
  // language has a page to point at.
  return {
    handoutTitle,
    environmentType: parsed.environmentType,
    environmentNumber: parsed.environmentNumber,
    handoutSlug: supportsLocale(handout, locale) ? handout.slug[locale] : null,
    anchorId: buildEnvAnchorId(parsed.environmentType, parsed.environmentNumber),
  }
}
