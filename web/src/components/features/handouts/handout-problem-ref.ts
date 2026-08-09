import envIndexData from '@/content/handout-env-index.json'
import handoutIndex from '@/content/handouts.json'
import type { Locale, PartialLocalizedString } from '@/i18n/i18n'
import { SUPPORTED_LOCALES } from '@/i18n/i18n'

import type { HandoutEnvironmentType } from './handout-content-types'
import type {
  HandoutEnvIndex,
  HandoutEnvironmentTarget,
  HandoutIndex,
  HandoutMetadata,
} from './handout-metadata-types'
import { supportsLocale } from './handout-metadata-types'
import { buildEnvironmentAnchorId } from './handout-utils'

/** The site's handout index. */
const index = handoutIndex as unknown as HandoutIndex

/** The generated environment index — see {@link HandoutEnvIndex}. */
const envIndex = envIndexData as unknown as HandoutEnvIndex

/** Every handout on the site, by its permanent content id. */
const handoutsByContentId = new Map(
  index.sections.flatMap((section) => section.handouts).map((handout) => [handout.id, handout])
)

/**
 * Finds the handout carrying a permanent content id.
 *
 * Read off a map built once with the module, since a problem is named many times over on one screen and a
 * fresh flatten of every handout on the site per lookup is a lot of nothing.
 *
 * @param handoutContentId - The handout's permanent content id.
 *
 * @returns The handout, or undefined once the site no longer carries it.
 */
export function findHandoutByContentId(handoutContentId: string): HandoutMetadata | undefined {
  // A problem outlives the handout it was held against, so a miss is an ordinary answer
  return handoutsByContentId.get(handoutContentId)
}

/**
 * Where to send a reader to reach one handout problem in a given language.
 */
type HandoutProblemLink = {
  /** The handout's URL slug in that language. */
  handoutSlug: string
  /** The DOM anchor id of the problem within its handout page. */
  anchorId: string
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
  /** How to link to the problem, or null when its handout isn't published in the requested locale. */
  link: HandoutProblemLink | null
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
  const handout = findHandoutByContentId(target.handoutContentId)

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

  // What this language calls the environment
  const environmentSlug = placement.slug[locale]

  // A handout published in this language names both itself and its environments in it, so the two either
  // travel together or there is no page to link to at all
  const handoutSlug = supportsLocale(handout, locale) ? handout.slug[locale] : undefined

  // Everything the caller needs to name and link to this environment
  return {
    handoutTitle,
    environmentType: placement.type,
    environmentNumber: placement.number,
    link:
      handoutSlug !== undefined && environmentSlug !== undefined
        ? { handoutSlug, anchorId: buildEnvironmentAnchorId(environmentSlug) }
        : null,
  }
}
