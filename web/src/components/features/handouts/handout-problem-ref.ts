import envIndexData from '@/content/handout-env-index.json'
import handoutIndex from '@/content/handouts.json'
import type { Locale, PartialLocalizedString } from '@/i18n/i18n'
import { SUPPORTED_LOCALES } from '@/i18n/i18n'

import type { HandoutEnvironmentType } from './handout-content-types'
import type {
  HandoutEnvIndex,
  HandoutEnvironmentTarget,
  HandoutIndex,
} from './handout-metadata-types'
import { supportsLocale } from './handout-metadata-types'
import { buildEnvironmentAnchorId } from './handout-utils'

/** The site's handout index. */
const index = handoutIndex as unknown as HandoutIndex

/** The generated environment index — see {@link HandoutEnvIndex}. */
const envIndex = envIndexData as unknown as HandoutEnvIndex

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
 * Resolves a defense target to its handout location, naming the handout in the given language and anchoring the
 * exact environment within it.
 *
 * @param target - The handout environment the defense is held against.
 * @param locale - The locale to resolve the title and slug in.
 *
 * @returns The resolved location, or null when the environment or its handout is gone from the site — a defense
 *   outlives the content it was about.
 */
export function resolveHandoutProblemRef(
  target: HandoutEnvironmentTarget,
  locale: Locale
): HandoutProblemRef | null {
  // Where this environment sits in its handout
  const placement = envIndex[target.handoutContentId]?.[target.environmentId]

  // No such environment recorded for this handout
  if (placement === undefined) {
    return null
  }

  // The handout itself, by its permanent content id
  const handout = index.sections
    .flatMap((section) => section.handouts)
    .find((candidate) => candidate.id === target.handoutContentId)

  // A target can outlive the handout it points at
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

  // Everything the caller needs to name and link to this environment
  return {
    handoutTitle,
    environmentType: placement.type,
    environmentNumber: placement.number,
    handoutSlug: supportsLocale(handout, locale) ? handout.slug[locale] : null,
    anchorId: buildEnvironmentAnchorId(target.environmentId),
  }
}
